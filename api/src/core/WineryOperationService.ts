import { WineryOperation, OperationType } from "../domain/nodes/WineryOperation";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { getDriver } from "../db/client";
import { Container } from "../domain/nodes/Container";
import { distributeComposition, blendCompositions } from "./CompositionHelpers";

export class WineryOperationService {
  // Intent: Build a transfer WineryOperation based on flows
  // Accepts N containers and flow quantities between them
  // Generates new output states and flow relationships accordingly
  static async buildWineryOperation(params: {
      id: string;
      tenantId: string;
      createdAt: Date;
      type: OperationType;
      description?: string;
      fromContainers: ContainerState[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint }[];
    }): Promise<WineryOperation> {
      const toContainers = this.createOutputStates(params);
      this.createFlows(params, toContainers);
      this.assignFlowCompositions(params.fromContainers);
      this.assignOutputCompositions(toContainers);

      return this.buildOperation(params, toContainers);
    }

  static async validateAndCommitOperation(operation: WineryOperation): Promise<WineryOperation> {
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
    if (operation.outputStates) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const containerRepo = new ContainerRepo(session);
        for (const outputState of operation.outputStates) {
          const container = await containerRepo.findById(outputState.container.id);
          if (!container) {
            throw new Error(`Output container ${outputState.container.id} not found`);
          }
        }
      } finally {
        await session.close();
      }
    }
  }

  private static createOutputStates(params: {
    tenantId: string;
    createdAt: Date;
    fromContainers: ContainerState[];
  }): ContainerState[] {
    return params.fromContainers.map(state => ({
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      createdAt: params.createdAt,
      container: state.container,
      quantifiedComposition: state.quantifiedComposition,
      timestamp: params.createdAt,
      isHead: true,
      flowsTo: [],
      flowsFrom: []
    }));

  }

  private static createFlows(
    params: {
      fromContainers: ContainerState[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint }[];
    },
    toContainers: ContainerState[]
  ): void {
    // 1. Create explicit flows
    for (const flow of params.flowQuantities) {
      const fromState = params.fromContainers.find(s => s.id === flow.fromStateId);
      const toState = toContainers.find(s => s.container.id === flow.toStateId);
      if (fromState && toState) {
        fromState.flowsTo.push({
          from: { id: fromState.id },
          to: { id: toState.id },
          properties: {
            qty: flow.qty,
            unit: fromState.quantifiedComposition.unit,
            attributes: {}
          }
        });
        toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
      }
    }

    // 2. Create remainder flows (auto-balancing)
    for (const fromState of params.fromContainers) {
      const explicitOutQty = fromState.flowsTo.reduce((sum, f) => sum + f.properties.qty, 0n);
      const remainder = fromState.quantifiedComposition.qty - explicitOutQty;
      
      if (remainder > 0n) {
        // Find the output state corresponding to this input container
        const toState = toContainers.find(s => s.container.id === fromState.container.id);
        if (toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: remainder,
              unit: fromState.quantifiedComposition.unit,
              attributes: {}
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }
    }
  }

  private static assignFlowCompositions(fromContainers: ContainerState[]): void {
    for (const fromState of fromContainers) {
      const flowQtys = fromState.flowsTo.map(f => f.properties.qty);
      const flowComps = distributeComposition(fromState.quantifiedComposition, flowQtys);
      for (let i = 0; i < fromState.flowsTo.length; i++) {
        fromState.flowsTo[i].properties = flowComps[i]; // qty, unit, attributes
      }
    }
  }

  private static assignOutputCompositions(toContainers: ContainerState[]): void {
    for (const toContainer of toContainers) {
      const incomingCompositions = toContainer.flowsFrom.map(flow => flow.properties);
      if (incomingCompositions.length > 0) {
        toContainer.quantifiedComposition = blendCompositions(incomingCompositions);
      } else {
        // No incoming flows; set to zero composition
        toContainer.quantifiedComposition = {
          qty: 0n,
          unit: toContainer.quantifiedComposition.unit,
          attributes: {}
        };
      }
    }
  }

  private static buildOperation(
    params: {
      id: string;
      tenantId: string;
      createdAt: Date;
      type: OperationType;
      description?: string;
      fromContainers: ContainerState[];
    },
    toContainers: ContainerState[]
  ): WineryOperation {
    const flows: FlowToRelationship[] = [];
    for (const state of params.fromContainers) {
      flows.push(...state.flowsTo);
    }

    return {
      id: params.id,
      tenantId: params.tenantId,
      createdAt: params.createdAt,
      type: params.type,
      description: params.description,
      inputStates: params.fromContainers,
      outputStates: toContainers,
      flows,
    };
  }

  // Helper: resolve container head via CURRENT_STATE pointer, or fallback to last state with no outgoing FLOW_TO
  private static async getHeadState(containerId: string): Promise<ContainerState | null> {
    const driver = getDriver();
    const session = driver.session();
    try {
      // First, get the container
      const containerRepo = new ContainerRepo(session);
      const container = await containerRepo.findById(containerId);
      if (!container) return null;

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
      const qtyNum = s.qty && typeof s.qty.toNumber === 'function' ? BigInt(s.qty.toNumber()) : (typeof s.qty === 'bigint' ? s.qty : BigInt(s.qty as number));
      const comp = s.composition ? JSON.parse(s.composition) : {};
      return {
        id: s.id,
        tenantId: s.tenantId,
        createdAt: new Date(s.createdAt),
        container: container,
        quantifiedComposition: {
          qty: qtyNum,
          unit: s.unit || 'gal',
          attributes: {
            varietals: comp.varietals ? Object.fromEntries(Object.entries(comp.varietals).map(([k, v]) => [k, BigInt(v as number)])) : {},
            realDollars: comp.realDollars ? BigInt(comp.realDollars as number) : 0n,
            nominalDollars: comp.nominalDollars ? BigInt(comp.nominalDollars as number) : 0n
          }
        },
        timestamp: new Date(s.timestamp),
        flowsTo: [],
        flowsFrom: [],
        isHead: true,
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