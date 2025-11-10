import { driver } from "../neo4jDriver";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { WineryOpInput, WineryOpOutput } from "../../domain/relationships/Movement";

export class WineryOperationRepo {
  static async createOperation(
    op: WineryOperation,
    inputs: WineryOpInput[],
    outputs: WineryOpOutput[]
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

          // Unwind inputs
          UNWIND $inputs AS inp
          MATCH (state:ContainerState {id: inp.fromId})
          CREATE (state)-[:WINERY_OP_INPUT {
            qty: inp.qty,
            unit: inp.unit,
            description: inp.desc
          }]->(op)

          WITH op
          UNWIND $outputs AS out
          MATCH (c:Container {id: out.containerId})
          CREATE (stateOut:ContainerState {
            id: out.stateId,
            volumeLiters: out.qty,
            composition: out.composition,
            timestamp: datetime()
          })
          CREATE (stateOut)-[:STATE_OF]->(c)
          CREATE (op)-[:WINERY_OP_OUTPUT {
            qty: out.qty,
            unit: out.unit
          }]->(stateOut)

          RETURN id(op) AS opId
          `,
          {
            id: op.id,
            type: op.type,
            description: op.description ?? null,
            tenantId: op.tenantId,
            createdAt: op.createdAt.toISOString(),
            inputs: inputs.map((i) => ({
              fromId: i.from.id,
              qty: i.properties.qty,
              unit: i.properties.unit,
              desc: i.properties.description ?? null,
            })),
            outputs: outputs.map((o) => ({
              containerId: o.to.id,
              stateId: `state_${o.to.id}_${Date.now()}`, // unique state id
              qty: o.properties.qty,
              unit: o.properties.unit
            })),
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
