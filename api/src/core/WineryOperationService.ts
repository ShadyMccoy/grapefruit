import { WineryOperation, OperationType } from "../domain/nodes/WineryOperation";
import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { getDriver } from "../db/client";
import { Container } from "../domain/nodes/Container";
import { generateFlowCompositions } from "./CompositionHelpers";

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
      flowQuantities: { fromStateId: string; toStateId: string; qty: number }[];
    }): Promise<WineryOperation> {
      // copy input states to new output states
      const toContainers: ContainerState[] = params.fromContainers.map(state => ({
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        createdAt: params.createdAt,
        container: state.container,
        quantifiedComposition: state.quantifiedComposition,
        timestamp: params.createdAt,
        flowsTo: [],
        flowsFrom: []
      }));

      // iterate over flow quantities and add a new flow relationship objects to each input state
      for (const flow of params.flowQuantities) {
        const fromState = params.fromContainers.find(s => s.id === flow.fromStateId);
        const toState = toContainers.find(s => s.container.id === flow.toStateId);
        if (fromState && toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: flow.qty,
              unit: fromState.quantifiedComposition.unit
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }

      //iterate over each input state to calculate the composition of each flows to
      for (const fromState of params.fromContainers) {
        generateFlowCompositions(
          fromState.quantifiedComposition,
          fromState.flowsTo)
        ;
      }

      // create the operation object
      const op: WineryOperation = {
        id: params.id,
        tenantId: params.tenantId,
        createdAt: params.createdAt,
        type: params.type,
        description: params.description,
        inputStates: params.fromContainers,
        outputStates: toContainers
      };

      return op;
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
      const qtyNum = s.qty && typeof s.qty.toNumber === 'function' ? s.qty.toNumber() : (typeof s.qty === 'bigint' ? Number(s.qty) : (s.qty as number));
      const comp = s.composition ? JSON.parse(s.composition) : {};
      return {
        id: s.id,
        tenantId: s.tenantId,
        createdAt: new Date(s.createdAt),
        container: container,
        quantifiedComposition: {
          qty: qtyNum,
          unit: s.unit || 'gal',
          varietals: comp.varietals,
          realDollars: comp.realDollars,
          nominalDollars: comp.nominalDollars
        },
        timestamp: new Date(s.timestamp),
        flowsTo: [],
        flowsFrom: []
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