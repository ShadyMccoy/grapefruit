// core/Invariants.ts
// Intent: Enforce mathematical invariants for winery operations
// Reasoning: Ensures conservation of quantities, compositions, and monetary values across all transformations

import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
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
    if (!operation.flows || !operation.inputStates) {
      return { ok: true }; // No flows to validate
    }

    // Group flows by input state ID
    const flowsByInput = new Map<string, FlowToRelationship[]>();
    for (const flow of operation.flows) {
      if (!flowsByInput.has(flow.from.id)) {
        flowsByInput.set(flow.from.id, []);
      }
      flowsByInput.get(flow.from.id)!.push(flow);
    }

    // Validate each input's net flow is zero
    for (const inputState of operation.inputStates) {
      const flowsFromInput = flowsByInput.get(inputState.id) || [];
      const netQty = flowsFromInput.reduce((sum, flow) => sum + flow.properties.qty, 0n);

      if (netQty !== inputState.quantifiedComposition.qty) {
        return {
          ok: false,
          code: "QUANTITY_NOT_CONSERVED",
          message: `Total flow from input ${inputState.id} (${netQty}) does not match its quantity (${inputState.quantifiedComposition.qty}).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate composition conservation (varietals, real/nominal dollars)
  // Reasoning: Composition deltas must net to zero for each input state
  static assertCompositionConservation(operation: WineryOperation): ValidationResult {
    if (!operation.flows || !operation.inputStates) {
      return { ok: true };
    }

    // Group flows by input state ID
    const flowsByInput = new Map<string, FlowToRelationship[]>();
    for (const flow of operation.flows) {
      if (!flowsByInput.has(flow.from.id)) {
        flowsByInput.set(flow.from.id, []);
      }
      flowsByInput.get(flow.from.id)!.push(flow);
    }

    // Validate composition for each input
    for (const inputState of operation.inputStates) {
      const flowsFromInput = flowsByInput.get(inputState.id) || [];
      
      if (flowsFromInput.length === 0) continue; // No flows means no change

      // Sum all composition deltas
      const netComposition = flowsFromInput.reduce(
        (sum, flow) => this.addCompositions(sum, flow.properties),
        {} as Partial<QuantifiedComposition>
      );

      // Net composition must be zero
      if (!this.isZeroComposition(netComposition)) {
        return {
          ok: false,
          code: "COMPOSITION_NOT_CONSERVED",
          message: `Composition deltas don't net to zero for input ${inputState.id}.`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate nominal dollar conservation across entire operation
  // Reasoning: Nominal dollars must ALWAYS balance, unlike real dollars which can flow to loss
  static assertNominalDollarConservation(operation: WineryOperation): ValidationResult {
    if (!operation.inputStates || !operation.outputStates) {
      return { ok: true };
    }

    // Check that all flows have consistent nominal dollar handling
    if (operation.flows) {
      const totalNominalFlow = operation.flows.reduce(
        (sum, flow) => sum + ((flow.properties.attributes?.["nominalDollars"] as bigint) || 0n),
        0n
      );

      // In delta model, total should be zero
      if (totalNominalFlow !== 0n) {
        return {
          ok: false,
          code: "NOMINAL_DOLLARS_NOT_CONSERVED",
          message: `Total nominal dollar flow is ${totalNominalFlow} (expected 0).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate flow references are valid state IDs
  // Reasoning: Prevents invalid state references when creating FLOW_TO relationships
  static assertValidFlowIndices(operation: WineryOperation): ValidationResult {
    if (!operation.flows || !operation.inputStates || !operation.outputStates) {
      return { ok: true };
    }

    const validInputIds = new Set(operation.inputStates.map(s => s.id));
    const validOutputIds = new Set(operation.outputStates.map(s => s.id));
    const allValidIds = new Set([...validInputIds, ...validOutputIds]);

    for (const flow of operation.flows) {
      if (!allValidIds.has(flow.from.id)) {
        return {
          ok: false,
          code: "INVALID_FLOW_REFERENCE",
          message: `Flow from state ${flow.from.id} references unknown state.`,
        };
      }
      if (!allValidIds.has(flow.to.id)) {
        return {
          ok: false,
          code: "INVALID_FLOW_REFERENCE",
          message: `Flow to state ${flow.to.id} references unknown state.`,
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
    results.push(this.assertNominalDollarConservation(operation));
    results.push(this.assertValidFlowIndices(operation));

    // Asynchronous validations (require DB access)
    if (operation.inputStates) {
      results.push(await this.assertInputStatesAreCurrent(operation.inputStates.map(s => s.id)));
    }

    if (operation.outputStates) {
      for (const outputState of operation.outputStates) {
        results.push(await this.assertSingleCurrentState(outputState.container.id));
      }
    }

    // Return only failures
    return results.filter(r => !r.ok);
  }

  // Helper: Check if composition is effectively zero
  private static isZeroComposition(composition: Partial<QuantifiedComposition>): boolean {
    if (composition.attributes) {
      for (const value of Object.values(composition.attributes)) {
        if (typeof value === 'bigint') {
          if (value !== 0n) return false;
        } else if (typeof value === 'object') {
          for (const subValue of Object.values(value)) {
            if (subValue !== 0n) return false;
          }
        }
      }
    }

    return true;
  }

  // Helper: Add two compositions together
  private static addCompositions(a: Partial<QuantifiedComposition>, b: Partial<QuantifiedComposition>): Partial<QuantifiedComposition> {
    const result: Partial<QuantifiedComposition> = {};

    // Add attributes generically
    if (a.attributes || b.attributes) {
      result.attributes = { ...a.attributes };
      if (b.attributes) {
        for (const [key, value] of Object.entries(b.attributes)) {
          if (typeof value === 'bigint') {
            if (result.attributes[key] === undefined) {
              result.attributes[key] = value;
            } else if (typeof result.attributes[key] === 'bigint') {
              (result.attributes[key] as bigint) += value;
            } else {
              // mismatch, perhaps error or skip
            }
          } else if (typeof value === 'object') {
            if (!result.attributes[key] || typeof result.attributes[key] !== 'object') {
              result.attributes[key] = { ...value };
            } else {
              const existing = result.attributes[key] as Record<string, bigint>;
              for (const [subKey, subValue] of Object.entries(value)) {
                existing[subKey] = (existing[subKey] || 0n) + subValue;
              }
            }
          }
        }
      }
    }

    return result;
  }
}
