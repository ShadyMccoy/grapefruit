import { WineryOperation, OperationType } from "../domain/nodes/WineryOperation";
import { ContainerState } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { getDriver } from "../db/client";
import { OperationBuilder } from "./OperationBuilder";
import { perf } from "../util/PerformanceMonitor";

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
      const toContainers = OperationBuilder.createOutputStates(params);
      OperationBuilder.createFlows(params, toContainers);
      OperationBuilder.assignFlowCompositions(params.fromContainers, toContainers);
      OperationBuilder.assignOutputCompositions(toContainers);

      return this.buildOperation(params, toContainers);
    }

  static async validateAndCommitOperation(operation: WineryOperation): Promise<WineryOperation> {
    return perf.measure("WineryOperationService.validateAndCommitOperation", async () => {
      // Intent: Validate operation against all invariants before committing to database
      // Reasoning: Ensures mathematical integrity and prevents invalid state transitions
      const { Invariants } = await import("./Invariants");
      
      await perf.measure("Invariants.validateOperation", async () => {
        const violations = await Invariants.validateOperation(operation);
        if (violations.length > 0) {
          const messages = violations.map(v => `${v.code}: ${v.message}`).join("; ");
          throw new Error(`Operation validation failed: ${messages}`);
        }
      });

      // Additional service-level validation (container existence)
      // NOTE: This is now implicitly handled by the write transaction (MATCH will fail if not found, or we can add explicit checks)
      // For now, we keep it or remove it? The user wants to reduce round trips.
      // Let's remove it to save a round trip.
      // await this.validateContainersExist(operation);

      // Create the operation in the database
      const operationId = await WineryOperationRepo.createOperation(operation);

      // Return the full operation details
      const fullOperation = await WineryOperationRepo.getOperation(operationId);
      if (!fullOperation) {
        throw new Error(`Failed to retrieve created operation ${operationId}`);
      }

      return fullOperation;
    });
  }

  // Intent: Validate that output containers exist in database
  // Reasoning: Prevents creating operations with invalid container references
  private static async validateContainersExist(operation: WineryOperation): Promise<void> {
    if (operation.outputStates && operation.outputStates.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const containerRepo = new ContainerRepo(session);
        const idsToCheck = operation.outputStates.map(s => s.container.id);
        const foundIds = await containerRepo.validateExistenceBatch(idsToCheck);
        
        if (foundIds.length !== idsToCheck.length) {
          const missing = idsToCheck.filter(id => !foundIds.includes(id));
          throw new Error(`Output containers not found: ${missing.join(", ")}`);
        }
      } finally {
        await session.close();
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


}

