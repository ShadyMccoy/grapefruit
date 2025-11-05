// db/repositories/ContainerRepo.ts
import { Session } from "neo4j-driver";
import { Container } from "../../domain/nodes/Container";

export class ContainerRepo {
  constructor(private session: Session) {}

  async create(container: Container): Promise<void> {
    await this.session.run(
      `
      CREATE (c:Container {
        id: $id,
        name: $name,
        type: $type,
        capacityLiters: $capacityLiters,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      `,
      container
    );
  }

  async findById(id: string): Promise<Container | null> {
    const result = await this.session.run(
      `MATCH (c:Container {id: $id}) RETURN c`,
      { id }
    );
    if (result.records.length === 0) return null;
    const c = result.records[0].get("c").properties;
    return { ...c, createdAt: new Date(c.createdAt) } as Container;
  }

  async findAll(): Promise<Container[]> {
    const result = await this.session.run(`MATCH (c:Container) RETURN c`);
    return result.records.map(r => {
      const c = r.get("c").properties;
      return { ...c, createdAt: new Date(c.createdAt) } as Container;
    });
  }
}
