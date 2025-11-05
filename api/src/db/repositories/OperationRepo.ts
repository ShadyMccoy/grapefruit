import { driver } from "../neo4jDriver";
import { WineryOperation } from "../../domain/nodes/Operation";
import { Movement, ResultedIn } from "../../domain/relationships/Movement";

export class OperationRepo {
  static async createOperation(
    op: WineryOperation,
    movements: Movement[],
    results: ResultedIn[]
  ): Promise<string> {
    const session = driver.session();
    try {
      const result = await session.executeWrite(async (tx) => {
        // 1️⃣ Create the operation node
        const opRes = await tx.run(
          `
          CREATE (op:WineryOperation {
            type: $type,
            description: $description
          })
          RETURN id(op) AS opId
          `,
          {
            type: op.type,
            description: op.description ?? null,
          }
        );

        const opId = opRes.records[0].get("opId").toNumber();

        // 2️⃣ Create input relationships (Movement)
        for (const move of movements) {
          await tx.run(
            `
            MATCH (state:ContainerState {id: $fromId}), (op:WineryOperation)
            WHERE id(op) = $opId
            CREATE (state)-[:MOVEMENT {
              qtyLiters: $qty,
              unit: $unit,
              description: $desc
            }]->(op)
            `,
            {
              fromId: move.from.id,
              opId,
              qty: move.properties.qtyLiters,
              unit: move.properties.unit,
              desc: move.properties.description ?? null,
            }
          );
        }

        // 3️⃣ Create output relationships (ResultedIn)
        for (const res of results) {
          await tx.run(
            `
            MATCH (op:WineryOperation), (state:ContainerState {id: $toId})
            WHERE id(op) = $opId
            CREATE (op)-[:RESULTED_IN {
              qtyLiters: $qty,
              unit: $unit
            }]->(state)
            `,
            {
              opId,
              toId: res.to.id,
              qty: res.properties.qtyLiters,
              unit: res.properties.unit,
            }
          );
        }

        return opId;
      });

      return result;
    } finally {
      await session.close();
    }
  }
}
