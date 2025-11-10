import { getDriver } from "../client";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { ContainerState, Composition } from "../../domain/nodes/ContainerState";

export class WineryOperationRepo {
  static async createOperation(op: WineryOperation): Promise<string> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const opId = await session.executeWrite(async (tx) => {
        const result = await tx.run(
          `
          // Create the operation
          CREATE (op:WineryOperation {
            id: $id,
            type: $type,
            description: $description,
            tenantId: $tenantId,
            createdAt: datetime($createdAt)
          })

          // Match input states and link to operation
          WITH op
          UNWIND $inputStateIds AS inputId
          MATCH (inputState:ContainerState {id: inputId})
          CREATE (op)-[:WINERY_OP_INPUT]->(inputState)

          // Create output state based on flows
          WITH op
          MATCH (outputContainer:Container {id: $outputContainerId})
          CREATE (outputState:ContainerState {
            id: $id + '_output',
            qty: reduce(total = 0, flow IN $flows | total + flow.qty),
            unit: 'gal',
            composition: $outputComposition,
            timestamp: datetime(),
            tenantId: $tenantId,
            createdAt: datetime($createdAt)
          })
          CREATE (outputState)-[:STATE_OF]->(outputContainer)
          CREATE (op)-[:WINERY_OP_OUTPUT]->(outputState)

          // Create flow relationships from inputs to output
          WITH op, outputState
          UNWIND range(0, size($flows) - 1) AS flowIndex
          WITH op, outputState, flowIndex, $flows[flowIndex] AS flow
          MATCH (fromState:ContainerState {id: $inputStateIds[toInteger(flow.from)]})
          CREATE (fromState)-[:FLOW_TO {
            qty: flow.qty,
            unit: 'gal',
            composition: fromState.composition
          }]->(outputState)

          RETURN id(op) AS opId
          `,
          {
            id: op.id,
            type: op.type,
            description: op.description ?? null,
            tenantId: op.tenantId,
            createdAt: op.createdAt.toISOString(),
            inputStateIds: op.inputStateIds || [],
            flows: op.flows || [],
            outputContainerId: op.outputContainerId,
            outputComposition: JSON.stringify({ varietals: { chardonnay: 0.556, pinot: 0.444 } }) // TODO: Calculate proper composition mixing from input states
          }
        );

        return result.records[0].get("opId").toNumber();
      });

      return opId;
    } finally {
      await session.close();
    }
  }

  static async getOperation(id: string): Promise<WineryOperation | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (op:WineryOperation {id: $id})
          OPTIONAL MATCH (op)-[:OP_RELATED_STATE_IN]->(inputState:ContainerState)
          OPTIONAL MATCH (op)-[:WINERY_OP_OUTPUT]->(outputState:ContainerState)
          OPTIONAL MATCH (op)-[:OPERATION_LOSS]->(lossState:ContainerState)
          RETURN op,
                 collect(DISTINCT inputState) AS inputStates,
                 collect(DISTINCT outputState) AS outputStates,
                 head(collect(DISTINCT lossState)) AS lossState
          `,
          { id }
        );
      });

      if (result.records.length === 0) return null;

      const record = result.records[0];
      const opNode = record.get("op").properties;
      const inputStates = record.get("inputStates").map((s: any) => ({
        ...s.properties,
        createdAt: new Date(s.properties.createdAt),
        timestamp: new Date(s.properties.timestamp)
      } as ContainerState));
      const outputStates = record.get("outputStates").map((s: any) => ({
        ...s.properties,
        createdAt: new Date(s.properties.createdAt),
        timestamp: new Date(s.properties.timestamp)
      } as ContainerState));
      const lossState = record.get("lossState") && record.get("lossState").properties ? {
        ...record.get("lossState").properties,
        createdAt: new Date(record.get("lossState").properties.createdAt),
        timestamp: new Date(record.get("lossState").properties.timestamp)
      } as ContainerState : undefined;

      return {
        ...opNode,
        createdAt: new Date(opNode.createdAt),
        inputStates,
        outputStates,
        lossState
      } as WineryOperation;
    } finally {
      await session.close();
    }
  }

  static async createTransferOperation(
    fromContainerId: string,
    toContainerId: string,
    transferQty: number,
    tenantId: string = 'winery1'
  ): Promise<string> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const opId = await session.executeWrite(async (tx) => {
        const result = await tx.run(
          `
          // Create the transfer operation
          CREATE (op:WineryOperation {
            id: 'transfer_' + toString(timestamp()) + '_' + toString(rand()),
            type: 'transfer',
            description: 'Transfer ' + toString($transferQty) + ' gallons from ' + $fromContainerId + ' to ' + $toContainerId,
            tenantId: $tenantId,
            createdAt: datetime()
          })

          // Match current states of both containers
          WITH op
          MATCH (fromContainer:Container {id: $fromContainerId})
          MATCH (toContainer:Container {id: $toContainerId})
          MATCH (fromState:ContainerState)-[:STATE_OF]->(fromContainer)
          WHERE NOT (fromState)-[:FLOW_TO]->()
          MATCH (toState:ContainerState)-[:STATE_OF]->(toContainer)
          WHERE NOT (toState)-[:FLOW_TO]->()

          // Link operation to input states (both containers)
          CREATE (op)-[:WINERY_OP_INPUT]->(fromState)
          CREATE (op)-[:WINERY_OP_INPUT]->(toState)

          // Create new state for from container (reduced qty)
          CREATE (newFromState:ContainerState {
            id: fromState.id + '_after_transfer_' + toString(timestamp()),
            qty: fromState.qty - $transferQty,
            unit: fromState.unit,
            composition: fromState.composition,
            timestamp: datetime(),
            tenantId: $tenantId,
            createdAt: datetime()
          })
          CREATE (newFromState)-[:STATE_OF]->(fromContainer)
          CREATE (op)-[:WINERY_OP_OUTPUT]->(newFromState)

          // Create new state for to container (increased qty)
          CREATE (newToState:ContainerState {
            id: toState.id + '_after_transfer_' + toString(timestamp()),
            qty: toState.qty + $transferQty,
            unit: toState.unit,
            composition: toState.composition, // TODO: Handle composition mixing if different - currently assumes destination composition unchanged
            timestamp: datetime(),
            tenantId: $tenantId,
            createdAt: datetime()
          })
          CREATE (newToState)-[:STATE_OF]->(toContainer)
          CREATE (op)-[:WINERY_OP_OUTPUT]->(newToState)

          // Create flow relationship from old from state to new from state
          CREATE (fromState)-[:FLOW_TO {
            qty: fromState.qty - $transferQty,
            unit: fromState.unit,
            composition: fromState.composition,
            deltaTime: duration({seconds: 0})
          }]->(newFromState)

          // Create flow relationship from old to state to new to state
          CREATE (toState)-[:FLOW_TO {
            qty: toState.qty,
            unit: toState.unit,
            composition: toState.composition,
            deltaTime: duration({seconds: 0})
          }]->(newToState)

          // Create flow relationship for transferred quantity from source to destination
          CREATE (fromState)-[:FLOW_TO {
            qty: $transferQty,
            unit: fromState.unit,
            composition: fromState.composition,
            deltaTime: duration({seconds: 0})
          }]->(newToState)

          RETURN id(op) AS opId
          `,
          {
            fromContainerId,
            toContainerId,
            transferQty,
            tenantId
          }
        );

        return result.records[0].get("opId").toNumber();
      });

      return opId;
    } finally {
      await session.close();
    }
  }
}
