import { driver } from "../neo4jDriver";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { FlowToRelationship } from "../../domain/relationships/Flow_to";
import { ContainerState, Composition } from "../../domain/nodes/ContainerState";

export class WineryOperationRepo {
  static async createOperation(
    op: WineryOperation,
    inputStateIds: string[],
    outputStates: { containerId: string; stateId: string; qty: number; unit: "gal" | "lbs"; composition?: Composition }[],
    flows: FlowToRelationship[]
  ): Promise<string> {
    const session = driver.session();

    try {
      const opId = await session.executeWrite(async (tx) => {
        const result = await tx.run(
          `
          CREATE (op:WineryOperation {
            id: $id,
            type: $type,
            description: $description,
            tenantId: $tenantId,
            createdAt: datetime($createdAt)
          })
          WITH op

          // Link operation to input states
          UNWIND $inputStateIds AS inputId
          MATCH (inputState:ContainerState {id: inputId})
          CREATE (op)-[:OP_RELATED_STATE_IN]->(inputState)

          WITH op
          // Create output states and link to operation
          UNWIND $outputStates AS out
          MATCH (c:Container {id: out.containerId})
          CREATE (stateOut:ContainerState {
            id: out.stateId,
            qty: out.qty,
            unit: out.unit,
            composition: out.composition,
            timestamp: datetime()
          })
          CREATE (stateOut)-[:STATE_OF]->(c)
          CALL {
            WITH op, stateOut, c
            WITH op, stateOut, c
            WHERE c.type = 'loss'
            CREATE (op)-[:OPERATION_LOSS]->(stateOut)
          }
          CALL {
            WITH op, stateOut, c
            WITH op, stateOut, c
            WHERE c.type <> 'loss'
            CREATE (op)-[:OP_RELATED_STATE_OUT]->(stateOut)
          }

          WITH op
          // Create FLOW_TO relationships
          UNWIND $flows AS flow
          MATCH (fromState:ContainerState {id: flow.from.id})
          MATCH (toState:ContainerState {id: flow.to.id})
          CREATE (fromState)-[:FLOW_TO {
            qty: flow.properties.qty,
            unit: flow.properties.unit,
            deltaTime: flow.properties.deltaTime,
            composition: flow.properties.composition
          }]->(toState)

          RETURN id(op) AS opId
          `,
          {
            id: op.id,
            type: op.type,
            description: op.description ?? null,
            tenantId: op.tenantId,
            createdAt: op.createdAt.toISOString(),
            inputStateIds: inputStateIds,
            outputStates: outputStates,
            flows: flows.map(f => ({
              from: { id: f.from.id },
              to: { id: f.to.id },
              properties: f.properties
            }))
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
    const session = driver.session();

    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          `
          MATCH (op:WineryOperation {id: $id})
          OPTIONAL MATCH (op)-[:OP_RELATED_STATE_IN]->(inputState:ContainerState)
          OPTIONAL MATCH (op)-[:OP_RELATED_STATE_OUT]->(outputState:ContainerState)
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
}
