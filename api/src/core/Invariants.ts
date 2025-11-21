// core/Invariants.ts
// Intent: Enforce mathematical invariants for winery operations
// Reasoning: Ensures conservation of quantities, compositions, and monetary values across all transformations

import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { ValidationResult } from "./ValidationResult";
import { getDriver } from "../db/client";
import { blendCompositions, compositionsEqual } from "./CompositionHelpers";

export class Invariants {
  // Intent: Validate that multiple containers have exactly one current state each
  // Reasoning: Batch optimization for assertSingleCurrentState
  static async assertSingleCurrentStateBatch(containerIds: string[]): Promise<ValidationResult[]> {
    if (!containerIds || containerIds.length === 0) return [];

    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          UNWIND $containerIds AS containerId
          MATCH (c:Container {id: containerId})
          OPTIONAL MATCH (c)-[:CURRENT_STATE]->(s:ContainerState)
          WITH containerId, count(s) AS currentCount
          WHERE currentCount > 1
          RETURN containerId, currentCount
          `,
          { containerIds }
        );
      });

      const failures: ValidationResult[] = [];
      result.records.forEach(record => {
        const id = record.get("containerId");
        const count = record.get("currentCount").toNumber();
        failures.push({
          ok: false,
          code: "MULTIPLE_CURRENT_STATES",
          message: `Container ${id} has ${count} current states (expected 1).`
        });
      });

      return failures;
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
    if (!operation.flows || !operation.inputStates || !operation.outputStates) {
      return { ok: true }; // No flows to validate
    }

    // Group flows by input state ID
    const flowsByInput = new Map<string, FlowToRelationship[]>();
    // Group flows by output state ID
    const flowsByOutput = new Map<string, FlowToRelationship[]>();

    for (const flow of operation.flows) {
      // By Input
      if (!flowsByInput.has(flow.from.id)) {
        flowsByInput.set(flow.from.id, []);
      }
      flowsByInput.get(flow.from.id)!.push(flow);

      // By Output
      if (!flowsByOutput.has(flow.to.id)) {
        flowsByOutput.set(flow.to.id, []);
      }
      flowsByOutput.get(flow.to.id)!.push(flow);
    }

    // 1. Validate Input Conservation: State Qty = Sum(Out Flows)
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
      
      // Validate positive flows - RELAXED for Inventory Adjustments (Gain/Loss)
      // Negative flows are allowed to model pre-gain (expansion) and post-loss (contraction)
      // within a single transaction.
      /*
      for (const flow of flowsFromInput) {
        if (flow.properties.qty < 0n) {
          return {
            ok: false,
            code: "NEGATIVE_FLOW",
            message: `Flow from ${flow.from.id} has negative quantity (${flow.properties.qty}). All flows must be positive.`,
          };
        }
      }
      */
    }

    // 2. Validate Output Conservation: Sum(In Flows) = State Qty
    for (const outputState of operation.outputStates) {
      const flowsToOutput = flowsByOutput.get(outputState.id) || [];
      const netQty = flowsToOutput.reduce((sum, flow) => sum + flow.properties.qty, 0n);

      if (netQty !== outputState.quantifiedComposition.qty) {
        return {
          ok: false,
          code: "QUANTITY_NOT_CONSERVED",
          message: `Total flow to output ${outputState.id} (${netQty}) does not match its quantity (${outputState.quantifiedComposition.qty}).`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate composition conservation (varietals, real/nominal dollars)
  // Reasoning: The sum of compositions of all outgoing flows from an input state must exactly match the input state's composition.
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
      
      if (flowsFromInput.length === 0) continue; 

      // Sum all outgoing flow compositions
      const flowCompositions = flowsFromInput.map(f => f.properties);
      const totalFlowComposition = blendCompositions(flowCompositions);

      // Compare with input composition
      if (!compositionsEqual(inputState.quantifiedComposition, totalFlowComposition)) {
        return {
          ok: false,
          code: "COMPOSITION_NOT_CONSERVED",
          message: `Sum of flow compositions from input ${inputState.id} does not match input composition.`,
        };
      }
    }

    return { ok: true };
  }

  // Intent: Validate nominal dollar conservation across entire operation
  // Reasoning: Nominal dollars must ALWAYS balance. Sum of inputs must equal sum of outputs.
  static assertNominalDollarConservation(operation: WineryOperation): ValidationResult {
    if (!operation.inputStates || !operation.outputStates) {
      return { ok: true };
    }

    const getNominalDollars = (comp: QuantifiedComposition): bigint => {
      const val = comp.attributes["nominalDollars"];
      return typeof val === 'bigint' ? val : 0n;
    };

    const totalInputNominal = operation.inputStates.reduce(
      (sum, state) => sum + getNominalDollars(state.quantifiedComposition),
      0n
    );

    const totalOutputNominal = operation.outputStates.reduce(
      (sum, state) => sum + getNominalDollars(state.quantifiedComposition),
      0n
    );

    if (totalInputNominal !== totalOutputNominal) {
      return {
        ok: false,
        code: "NOMINAL_DOLLARS_NOT_CONSERVED",
        message: `Total nominal dollars in (${totalInputNominal}) does not match total out (${totalOutputNominal}).`,
      };
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
    results.push(this.assertCompositionConservation(operation));
    results.push(this.assertNominalDollarConservation(operation));
    results.push(this.assertValidFlowIndices(operation));

    // Asynchronous validations (require DB access)
    // NOTE: These are now handled inside the write transaction for performance/atomicity.
    // Keeping them here for reference or if we need "dry run" validation.
    /*
    if (operation.inputStates) {
      results.push(await this.assertInputStatesAreCurrent(operation.inputStates.map(s => s.id)));
    }

    if (operation.outputStates && operation.outputStates.length > 0) {
      const containerIds = operation.outputStates.map(s => s.container.id);
      const batchFailures = await this.assertSingleCurrentStateBatch(containerIds);
      results.push(...batchFailures);
    }
    */

    // Return only failures
    return results.filter(r => !r.ok);
  }
}

