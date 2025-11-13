import { WineryOperation, FlowSpec } from "../domain/nodes/WineryOperation";
import { ContainerState, Composition } from "../domain/nodes/ContainerState";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { getDriver } from "../db/client";

export class WineryOperationService {
  // Intent: Build a transfer WineryOperation dynamically from container IDs and qty.
  // Reasoning: Use CURRENT_STATE (or fallback to head with no outgoing FLOW_TO) to derive inputs and compositions.
  static async buildTransferOperation(params: {
    id: string;
    tenantId: string;
    fromContainerId: string;
    toContainerId: string;
    qty: number; // h-units (here using gallons as seeded)
    createdAt: Date;
    description?: string;
  }): Promise<WineryOperation> {
    const { id, tenantId, fromContainerId, toContainerId, qty, createdAt, description } = params;

    // Fetch current (head) states for from/to containers
    const [fromState, toState] = await Promise.all([
      this.getHeadState(fromContainerId),
      this.getHeadState(toContainerId)
    ]);

    if (!fromState) throw new Error(`No current state found for container ${fromContainerId}`);
    if (!toState) throw new Error(`No current state found for container ${toContainerId}`);

    // Compute dollars per unit from the source (fromState)
    const fromRealPerUnit = (fromState.composition.realDollars || 0) / (fromState.qty || 1);
    const fromNominalPerUnit = (fromState.composition.nominalDollars || 0) / (fromState.qty || 1);
    const transferReal = Math.round(fromRealPerUnit * qty);
    const transferNominal = Math.round(fromNominalPerUnit * qty);

    // Compute varietal split for transfer based on source composition
    const transferVarietals: Record<string, number> = {};
    if (fromState.composition.varietals) {
      const totalVol = fromState.qty || 1;
      for (const [varietal, amount] of Object.entries(fromState.composition.varietals)) {
        const portion = (amount / totalVol) * qty;
        transferVarietals[varietal] = Math.round(portion);
      }
    }

    // Build outputs
    const outFromQty = fromState.qty - qty;
    const outFromComp = {
      varietals: mergeVarietals(fromState.composition.varietals, scaleVarietals(transferVarietals, -1)),
      realDollars: (fromState.composition.realDollars || 0) - transferReal,
      nominalDollars: (fromState.composition.nominalDollars || 0) - transferNominal
    } as Composition;

    const outToQty = toState.qty + qty;
    const outToComp = {
      varietals: mergeVarietals(toState.composition.varietals, transferVarietals),
      realDollars: (toState.composition.realDollars || 0) + transferReal,
      nominalDollars: (toState.composition.nominalDollars || 0) + transferNominal
    } as Composition;

    // Assemble WineryOperation
    const op: WineryOperation = {
      id,
      type: "transfer",
      tenantId,
      createdAt,
      description,
      inputStateIds: [fromState.id, toState.id],
      outputSpecs: [
        {
          containerId: fromState.container.id,
          stateId: `${id}__${fromState.container.id}`,
          qty: outFromQty,
          unit: fromState.unit,
          composition: outFromComp
        },
        {
          containerId: toState.container.id,
          stateId: `${id}__${toState.container.id}`,
          qty: outToQty,
          unit: toState.unit,
          composition: outToComp
        }
      ],
      flows: [
        { from: 0, to: 1, qty: qty, unit: fromState.unit, composition: { varietals: transferVarietals, realDollars: transferReal, nominalDollars: transferNominal } },
        { from: 0, to: 0, qty: -qty, unit: fromState.unit, composition: { varietals: scaleVarietals(transferVarietals, -1), realDollars: -transferReal, nominalDollars: -transferNominal } },
        { from: 1, to: 1, qty: 0, unit: toState.unit, composition: {} }
      ]
    };

    return op;
  }
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

  // Helper: resolve container head via CURRENT_STATE pointer, or fallback to last state with no outgoing FLOW_TO
  private static async getHeadState(containerId: string): Promise<ContainerState | null> {
    const driver = getDriver();
    const session = driver.session();
    try {
      const res = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (c:Container {id: $containerId})
          OPTIONAL MATCH (c)-[:CURRENT_STATE]->(curr:ContainerState)
          WITH c, curr
          OPTIONAL MATCH (s:ContainerState)-[:STATE_OF]->(c)
          WHERE NOT (s)-[:FLOW_TO]->()
          WITH c, curr, s
          ORDER BY s.timestamp DESC
          WITH curr, collect(s)[0] AS lastHead
          RETURN coalesce(curr, lastHead) AS head
          `,
          { containerId }
        );
      });

      if (res.records.length === 0) return null;
      const node = res.records[0].get("head");
      if (!node) return null;
      const s = node.properties as any;
      const qtyNum = s.qty && typeof s.qty.toNumber === 'function' ? s.qty.toNumber() : (typeof s.qty === 'bigint' ? Number(s.qty) : (s.qty as number));
      return {
        ...s,
        qty: qtyNum,
        timestamp: new Date(s.timestamp),
        createdAt: new Date(s.createdAt),
        composition: s.composition ? JSON.parse(s.composition) : {},
        container: { id: containerId } as any
      } as ContainerState;
    } finally {
      await session.close();
    }
  }
}

// Local pure helpers for varietal math
function mergeVarietals(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...(a || {}) };
  if (b) {
    for (const [k, v] of Object.entries(b)) {
      out[k] = (out[k] || 0) + v;
      if (Math.abs(out[k]) < 0.0001) delete out[k];
    }
  }
  return out;
}

function scaleVarietals(a?: Record<string, number>, k: number = 1): Record<string, number> | undefined {
  if (!a) return undefined;
  const out: Record<string, number> = {};
  for (const [name, amt] of Object.entries(a)) {
    const v = amt * k;
    if (Math.abs(v) >= 0.0001) out[name] = v;
  }
  return out;
}