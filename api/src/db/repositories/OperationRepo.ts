// db/repositories/OperationRepo.ts
import { Session } from "neo4j-driver";
import { Operation } from "../../domain/Operation";

export class OperationRepo {
  constructor(private session: Session) {}

  async create(op: Operation): Promise<void> {
    await this.session.run(
      `
      CREATE (o:Operation {
        id: $id,
        type: $type,
        description: $description,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      `,
      {
        ...op,
        createdAt: op.createdAt.toISOString(),
      }
    );
  }

  async findById(id: string): Promise<Operation | null> {
    const result = await this.session.run(
      `MATCH (o:Operation {id: $id}) RETURN o`,
      { id }
    );
    if (result.records.length === 0) return null;
    const o = result.records[0].get("o").properties;
    return { ...o, createdAt: new Date(o.createdAt) } as Operation;
  }
}
