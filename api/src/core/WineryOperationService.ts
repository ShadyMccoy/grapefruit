import { WineryOperation, FlowSpec } from "../domain/nodes/WineryOperation";
import { ContainerState, Composition } from "../domain/nodes/ContainerState";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { getDriver } from "../db/client";

export class WineryOperationService {
  static async createOperation(operation: WineryOperation): Promise<WineryOperation> {
    // Validate operation
    await this.validateOperation(operation);

    // Create the operation in the database
    const operationId = await WineryOperationRepo.createOperation(operation);

    // Return the full operation details
    const fullOperation = await WineryOperationRepo.getOperation(operationId);
    if (!fullOperation) {
      throw new Error(`Failed to retrieve created operation ${operationId}`);
    }

    return fullOperation;
  }

  private static async validateOperation(operation: WineryOperation): Promise<void> {
    // TODO: Check that all referenced states are current (no outgoing flows)
    // if (operation.inputStateIds) {
    //   for (const stateId of operation.inputStateIds) {
    //     const isCurrent = await this.isCurrentState(stateId);
    //     if (!isCurrent) {
    //       throw new Error(`Input state ${stateId} is not current`);
    //     }
    //   }
    // }

    // Validate quantity conservation
    await this.validateQuantityConservation(operation);

    // Validate that output containers exist
    if (operation.outputSpecs) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const containerRepo = new ContainerRepo(session);
        for (const outputSpec of operation.outputSpecs) {
          const container = await containerRepo.findById(outputSpec.containerId);
          if (!container) {
            throw new Error(`Output container ${outputSpec.containerId} not found`);
          }
        }
      } finally {
        await session.close();
      }
    }

    // Legacy support for single output container
    if (operation.outputContainerId && !operation.outputSpecs) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const containerRepo = new ContainerRepo(session);
        const container = await containerRepo.findById(operation.outputContainerId);
        if (!container) {
          throw new Error(`Output container ${operation.outputContainerId} not found`);
        }
      } finally {
        await session.close();
      }
    }
  }

  private static async isCurrentState(stateId: string): Promise<boolean> {
    // A state is current if it has no outgoing FLOW_TO relationships
    const driver = (await import("../db/client")).getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (s:ContainerState {id: $stateId})
          OPTIONAL MATCH (s)-[out:FLOW_TO]->()
          RETURN count(out) = 0 AS isCurrent
          `,
          { stateId }
        );
      });

      return result.records[0].get("isCurrent");
    } finally {
      await session.close();
    }
  }

  private static async validateQuantityConservation(operation: WineryOperation): Promise<void> {
    if (!operation.flows || !operation.inputStateIds || !operation.outputSpecs) {
      return; // Skip validation if required data not provided
    }

    // Get input state details for composition validation
    const inputStates = await this.getInputStates(operation.inputStateIds);

    // Group flows by input state
    const flowsByInput = new Map<number, FlowSpec[]>();
    for (const flow of operation.flows) {
      if (!flowsByInput.has(flow.from)) {
        flowsByInput.set(flow.from, []);
      }
      flowsByInput.get(flow.from)!.push(flow);
    }

    // Validate each input state's composition is properly distributed
    for (let inputIndex = 0; inputIndex < operation.inputStateIds.length; inputIndex++) {
      const inputState = inputStates[inputIndex];
      const flowsFromInput = flowsByInput.get(inputIndex) || [];

      // Delta modeling: per-input net flow must be zero and composition deltas sum to input composition
      // (We intentionally do NOT require sum(flow.qty) == inputState.qty here.)
      this.validateCompositionDistribution(inputState, flowsFromInput);
    }

    // Validate flow indices
    const maxInputIndex = operation.inputStateIds.length - 1;
    const maxOutputIndex = operation.outputSpecs.length - 1;

    for (const flow of operation.flows) {
      if (flow.from < 0 || flow.from > maxInputIndex) {
        throw new Error(`Invalid flow from index: ${flow.from}`);
      }
      if (flow.to < 0 || flow.to > maxOutputIndex) {
        throw new Error(`Invalid flow to index: ${flow.to}`);
      }
    }
  }

  private static async getInputStates(inputStateIds: string[]): Promise<ContainerState[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (s:ContainerState)
          WHERE s.id IN $stateIds
          RETURN s
          `,
          { stateIds: inputStateIds }
        );
      });

      return result.records.map(r => {
        const s = r.get("s").properties;
        return {
          ...s,
          timestamp: new Date(s.timestamp),
          createdAt: new Date(s.createdAt),
          composition: JSON.parse(s.composition)
        } as ContainerState;
      });
    } finally {
      await session.close();
    }
  }

  private static validateCompositionDistribution(inputState: ContainerState, flows: FlowSpec[]): void {
    // For delta-based flows, if there are no flows from this input, it means no change (net zero)
    if (flows.length === 0) {
      return; // No validation needed for inputs with no flows
    }

    // For inputs with flows, the net flow should be zero (delta modeling)
    const netQtyFromInput = flows.reduce((sum, flow) => sum + flow.qty, 0);

    // Net flow should be zero for delta modeling
    if (Math.abs(netQtyFromInput) > 0.001) {
      throw new Error(`Net flow from input should be zero for delta modeling: ${netQtyFromInput}`);
    }

    // Sum compositions from all flows (delta modeling expects net-zero composition)
    const summedComposition = flows.reduce((sum, flow) => this.addCompositions(sum, flow.composition), {} as Composition);

    // For delta modeling the net composition delta must be zero
    if (!this.isZeroComposition(summedComposition)) {
      throw new Error(`Sum of flow compositions doesn't net to zero for delta modeling`);
    }
  }

  private static isZeroComposition(composition: Composition): boolean {
    if (composition.varietals) {
      for (const amount of Object.values(composition.varietals)) {
        if (Math.abs(amount) > 0.001) return false;
      }
    }
    if (Math.abs((composition.realDollars || 0)) > 0.001) return false;
    if (Math.abs((composition.nominalDollars || 0)) > 0.001) return false;
    return true;
  }

  private static scaleComposition(composition: Composition, scale: number): Composition {
    const result: Composition = {};

    if (composition.varietals) {
      result.varietals = {};
      for (const [varietal, amount] of Object.entries(composition.varietals)) {
        result.varietals[varietal] = amount * scale;
      }
    }

    if (composition.realDollars !== undefined) {
      result.realDollars = composition.realDollars * scale;
    }

    if (composition.nominalDollars !== undefined) {
      result.nominalDollars = composition.nominalDollars * scale;
    }

    return result;
  }

  private static addCompositions(a: Composition, b: Composition): Composition {
    const result: Composition = {};

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

  private static compositionsEqual(a: Composition, b: Composition): boolean {
    // Compare varietals
    if (a.varietals || b.varietals) {
      if (!a.varietals || !b.varietals) return false;
      const aVarietals = Object.keys(a.varietals).sort();
      const bVarietals = Object.keys(b.varietals).sort();
      if (aVarietals.length !== bVarietals.length) return false;
      for (let i = 0; i < aVarietals.length; i++) {
        if (aVarietals[i] !== bVarietals[i]) return false;
        const aAmount = a.varietals[aVarietals[i]];
        const bAmount = b.varietals[bVarietals[i]];
        if (Math.abs(aAmount - bAmount) > 0.001) return false;
      }
    }

    // Compare dollars
    if (Math.abs((a.realDollars || 0) - (b.realDollars || 0)) > 0.001) return false;
    if (Math.abs((a.nominalDollars || 0) - (b.nominalDollars || 0)) > 0.001) return false;

    return true;
  }
}