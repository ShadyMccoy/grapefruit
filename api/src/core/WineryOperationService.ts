import { WineryOperation, FlowSpec } from "../domain/nodes/WineryOperation";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
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
    const fromRealPerUnit = (fromState.quantifiedComposition.realDollars || 0) / (fromState.quantifiedComposition.qty || 1);
    const fromNominalPerUnit = (fromState.quantifiedComposition.nominalDollars || 0) / (fromState.quantifiedComposition.qty || 1);
    const transferReal = Math.round(fromRealPerUnit * qty);
    const transferNominal = Math.round(fromNominalPerUnit * qty);

    // Compute varietal split for transfer based on source composition
    const transferVarietals: Record<string, number> = {};
    if (fromState.quantifiedComposition.varietals) {
      const totalVol = fromState.quantifiedComposition.qty || 1;
      for (const [varietal, amount] of Object.entries(fromState.quantifiedComposition.varietals)) {
        const portion = (amount / totalVol) * qty;
        transferVarietals[varietal] = Math.round(portion);
      }
    }

    // Build outputs
    const outFromQty = fromState.quantifiedComposition.qty - qty;
    const outFromComp: Partial<QuantifiedComposition> = {
      varietals: mergeVarietals(fromState.quantifiedComposition.varietals, scaleVarietals(transferVarietals, -1)),
      realDollars: (fromState.quantifiedComposition.realDollars || 0) - transferReal,
      nominalDollars: (fromState.quantifiedComposition.nominalDollars || 0) - transferNominal
    };

    const outToQty = toState.quantifiedComposition.qty + qty;
    const outToComp: Partial<QuantifiedComposition> = {
      varietals: mergeVarietals(toState.quantifiedComposition.varietals, transferVarietals),
      realDollars: (toState.quantifiedComposition.realDollars || 0) + transferReal,
      nominalDollars: (toState.quantifiedComposition.nominalDollars || 0) + transferNominal
    };

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
          unit: fromState.quantifiedComposition.unit,
          varietals: outFromComp.varietals,
          realDollars: outFromComp.realDollars,
          nominalDollars: outFromComp.nominalDollars
        },
        {
          containerId: toState.container.id,
          stateId: `${id}__${toState.container.id}`,
          qty: outToQty,
          unit: toState.quantifiedComposition.unit,
          varietals: outToComp.varietals,
          realDollars: outToComp.realDollars,
          nominalDollars: outToComp.nominalDollars
        }
      ],
      flows: [
        { from: 0, to: 1, qty: qty, unit: fromState.quantifiedComposition.unit, composition: { varietals: transferVarietals, realDollars: transferReal, nominalDollars: transferNominal } },
        { from: 0, to: 0, qty: -qty, unit: fromState.quantifiedComposition.unit, composition: { varietals: scaleVarietals(transferVarietals, -1), realDollars: -transferReal, nominalDollars: -transferNominal } },
        { from: 1, to: 1, qty: 0, unit: toState.quantifiedComposition.unit, composition: {} }
      ]
    };

    return op;
  }
  static async createOperation(operation: WineryOperation): Promise<WineryOperation> {
    // Intent: Validate operation against all invariants before committing to database
    // Reasoning: Ensures mathematical integrity and prevents invalid state transitions
    const { Invariants } = await import("./Invariants");
    const violations = await Invariants.validateOperation(operation);
    
    if (violations.length > 0) {
      const messages = violations.map(v => `${v.code}: ${v.message}`).join("; ");
      throw new Error(`Operation validation failed: ${messages}`);
    }

    // Additional service-level validation (container existence)
    await this.validateContainersExist(operation);

    // Create the operation in the database
    const operationId = await WineryOperationRepo.createOperation(operation);

    // Return the full operation details
    const fullOperation = await WineryOperationRepo.getOperation(operationId);
    if (!fullOperation) {
      throw new Error(`Failed to retrieve created operation ${operationId}`);
    }

    return fullOperation;
  }

  // Intent: Validate that output containers exist in database
  // Reasoning: Prevents creating operations with invalid container references
  private static async validateContainersExist(operation: WineryOperation): Promise<void> {
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
      const comp = s.composition ? JSON.parse(s.composition) : {};
      return {
        ...s,
        timestamp: new Date(s.timestamp),
        createdAt: new Date(s.createdAt),
        quantifiedComposition: {
          qty: qtyNum,
          unit: s.unit || 'gal',
          varietals: comp.varietals,
          realDollars: comp.realDollars,
          nominalDollars: comp.nominalDollars
        },
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