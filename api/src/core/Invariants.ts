// core/Invariants.ts
// Intent: Enforce mathematical invariants for winery operations
// Reasoning: Ensures conservation of quantities, compositions, and monetary values across all transformations

import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { WineryOperation, FlowSpec } from "../domain/nodes/WineryOperation";
import { ValidationResult } from "./ValidationResult";
import { getDriver } from "../db/client";

export class Invariants {
  // Intent: Validate that a container has exactly one current state
  // Reasoning: Multiple current states would create ambiguity in the timeline
  static async assertSingleCurrentState(containerId: string): Promise<ValidationResult> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (c:Container {id: $containerId})-[:CURRENT_STATE]->(s:ContainerState)
          RETURN count(s) AS currentCount
          `,
          { containerId }
        );
      });

      const count = result.records[0].get("currentCount").toNumber();
      if (count > 1) {
        return {
          ok: false,
          code: "MULTIPLE_CURRENT_STATES",
          message: `Container ${containerId} has ${count} current states (expected 1).`,
        };
      }

      return { ok: true };
    } finally {
      await session.close();
    }
  }

  // Intent: Validate that all input states are current (have no outgoing FLOW_TO)
  // Reasoning: Operations should only consume head states, not intermediate historical states
  static async assertInputStatesAreCurrent(inputStateIds: string[]): Promise<ValidationResult> {
    if (!inputStateIds || inputStateIds.length === 0) {
      return { ok: true };
    }

    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          UNWIND $stateIds AS stateId
          MATCH (s:ContainerState {id: stateId})
          OPTIONAL MATCH (s)-[out:FLOW_TO]->()
          WITH s.id AS id, count(out) AS outgoingFlows
          WHERE outgoingFlows > 0
          RETURN collect(id) AS nonCurrentStates
          `,
          { stateIds: inputStateIds }
        );
      });

      const nonCurrent = result.records[0].get("nonCurrentStates");
      if (nonCurrent.length > 0) {
        return {
          ok: false,
          code: "INPUT_NOT_CURRENT",
          message: `Input states are not current (have outgoing flows): ${nonCurrent.join(", ")}`,
        };
      }

      return { ok: true };
    } finally {
      await session.close();
    }
  }

  // Intent: Validate quantity conservation using delta-based flow model
  // Reasoning: Net flows from each input must sum to zero (what goes out must come back in)
  static assertQuantityConservation(operation: WineryOperation): ValidationResult {
    if (!operation.flows || !operation.inputStateIds) {
      return { ok: true }; // No flows to validate
    }

    // Group flows by input state index
    const flowsByInput = new Map<number, FlowSpec[]>();
    for (const flow of operation.flows) {
      if (!flowsByInput.has(flow.from)) {
        flowsByInput.set(flow.from, []);
      }
      flowsByInput.get(flow.from)!.push(flow);
    }

    // Validate each input's net flow is zero
    for (let inputIndex = 0; inputIndex < operation.inputStateIds.length; inputIndex++) {
      const flowsFromInput = flowsByInput.get(inputIndex) || [];
      const netQty = flowsFromInput.reduce((sum, flow) => sum + flow.qty, 0);

      if (Math.abs(netQty) > 0.001) {
        return {
          ok: false,
          code: "QUANTITY_NOT_CONSERVED",
          message: `Net flow from input ${inputIndex} is ${netQty} (expected 0 for delta model).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate composition conservation (varietals, real/nominal dollars)
  // Reasoning: Composition deltas must net to zero for each input state
  static assertCompositionConservation(operation: WineryOperation): ValidationResult {
    if (!operation.flows || !operation.inputStateIds) {
      return { ok: true };
    }

    // Group flows by input state index
    const flowsByInput = new Map<number, FlowSpec[]>();
    for (const flow of operation.flows) {
      if (!flowsByInput.has(flow.from)) {
        flowsByInput.set(flow.from, []);
      }
      flowsByInput.get(flow.from)!.push(flow);
    }

    // Validate composition for each input
    for (let inputIndex = 0; inputIndex < operation.inputStateIds.length; inputIndex++) {
      const flowsFromInput = flowsByInput.get(inputIndex) || [];
      
      if (flowsFromInput.length === 0) continue; // No flows means no change

      // Sum all composition deltas
      const netComposition = flowsFromInput.reduce(
        (sum, flow) => this.addCompositions(sum, flow.composition),
        {} as Partial<QuantifiedComposition>
      );

      // Net composition must be zero
      if (!this.isZeroComposition(netComposition)) {
        return {
          ok: false,
          code: "COMPOSITION_NOT_CONSERVED",
          message: `Composition deltas don't net to zero for input ${inputIndex}.`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate nominal dollar conservation across entire operation
  // Reasoning: Nominal dollars must ALWAYS balance, unlike real dollars which can flow to loss
  static assertNominalDollarConservation(operation: WineryOperation): ValidationResult {
    if (!operation.inputStateIds || !operation.outputSpecs) {
      return { ok: true };
    }

    // Calculate total nominal dollars from input states (would need to fetch from DB in real impl)
    // For now, validate that flows balance (which is checked in composition conservation)
    // This is a placeholder for more comprehensive check that would query actual input states

    // Check that all flows have consistent nominal dollar handling
    if (operation.flows) {
      const totalNominalFlow = operation.flows.reduce(
        (sum, flow) => sum + (flow.composition?.nominalDollars || 0),
        0
      );

      // In delta model, total should be zero
      if (Math.abs(totalNominalFlow) > 0.001) {
        return {
          ok: false,
          code: "NOMINAL_DOLLARS_NOT_CONSERVED",
          message: `Total nominal dollar flow is ${totalNominalFlow} (expected 0).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate flow indices are within bounds
  // Reasoning: Prevents index out-of-bounds errors when creating FLOW_TO relationships
  static assertValidFlowIndices(operation: WineryOperation): ValidationResult {
    if (!operation.flows || !operation.inputStateIds || !operation.outputSpecs) {
      return { ok: true };
    }

    const maxInputIndex = operation.inputStateIds.length - 1;
    const maxOutputIndex = operation.outputSpecs.length - 1;

    for (const flow of operation.flows) {
      if (flow.from < 0 || flow.from > maxInputIndex) {
        return {
          ok: false,
          code: "INVALID_FLOW_INDEX",
          message: `Flow from index ${flow.from} is out of bounds (max: ${maxInputIndex}).`,
        };
      }
      if (flow.to < 0 || flow.to > maxOutputIndex) {
        return {
          ok: false,
          code: "INVALID_FLOW_INDEX",
          message: `Flow to index ${flow.to} is out of bounds (max: ${maxOutputIndex}).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Batch validation of all invariants for an operation
  // Reasoning: Run all checks before committing to database to ensure integrity
  static async validateOperation(operation: WineryOperation): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Synchronous validations (no DB access needed)
    results.push(this.assertQuantityConservation(operation));
    results.push(this.assertCompositionConservation(operation));
    results.push(this.assertNominalDollarConservation(operation));
    results.push(this.assertValidFlowIndices(operation));

    // Asynchronous validations (require DB access)
    if (operation.inputStateIds) {
      results.push(await this.assertInputStatesAreCurrent(operation.inputStateIds));
    }

    if (operation.outputSpecs) {
      for (const spec of operation.outputSpecs) {
        results.push(await this.assertSingleCurrentState(spec.containerId));
      }
    }

    // Return only failures
    return results.filter(r => !r.ok);
  }

  // Helper: Check if composition is effectively zero
  private static isZeroComposition(composition: Partial<QuantifiedComposition>): boolean {
    const tolerance = 0.001;

    if (composition.varietals) {
      for (const amount of Object.values(composition.varietals)) {
        if (Math.abs(amount) > tolerance) return false;
      }
    }

    if (Math.abs(composition.realDollars || 0) > tolerance) return false;
    if (Math.abs(composition.nominalDollars || 0) > tolerance) return false;

    return true;
  }

  // Helper: Add two compositions together
  private static addCompositions(a: Partial<QuantifiedComposition>, b: Partial<QuantifiedComposition>): Partial<QuantifiedComposition> {
    const result: Partial<QuantifiedComposition> = {};

    // Add varietals
    if (a.varietals || b.varietals) {
      result.varietals = { ...a.varietals };
      if (b.varietals) {
        for (const [varietal, amount] of Object.entries(b.varietals)) {
          result.varietals[varietal] = (result.varietals[varietal] || 0) + amount;
        }
      }
    }

    // Add dollars
    if (a.realDollars !== undefined || b.realDollars !== undefined) {
      result.realDollars = (a.realDollars || 0) + (b.realDollars || 0);
    }
    if (a.nominalDollars !== undefined || b.nominalDollars !== undefined) {
      result.nominalDollars = (a.nominalDollars || 0) + (b.nominalDollars || 0);
    }

    return result;
  }
}
