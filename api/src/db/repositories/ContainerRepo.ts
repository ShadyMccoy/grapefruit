// db/repositories/ContainerRepo.ts
import neo4j, { Session } from "neo4j-driver";
import { Container } from "../../domain/nodes/Container";
import { ContainerState } from "../../domain/nodes/ContainerState";
import { deserializeAttributes } from "../../util/attributeSerialization";

export class ContainerRepo {
  constructor(private session: Session) { }

  async create(container: Container): Promise<void> {
    const params = {
      id: container.id,
      name: container.name,
      type: container.type,
      tenantId: container.tenantId,
      createdAt: container.createdAt.toISOString()
    };

    let query = `
      CREATE (c:Container {
        id: $id,
        name: $name,
        type: $type,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      `;

    if (container.capacityHUnits !== undefined) {
      query += `,
        capacityHUnits: $capacityHUnits`;
      (params as any).capacityHUnits = container.capacityHUnits;
    }

    query += `})`;

    await this.session.run(query, params);

  }

  async findById(id: string): Promise<Container | null> {
    const result = await this.session.run(
      `MATCH (c:Container {id: $id}) RETURN c`,
      { id }
    );
    if (result.records.length === 0) return null;
    const c = result.records[0].get("c").properties;
    
    const capacity = c.capacityHUnits 
      ? (neo4j.isInt(c.capacityHUnits) ? c.capacityHUnits.toBigInt() : BigInt(c.capacityHUnits))
      : undefined;

    return { 
      ...c, 
      createdAt: new Date(c.createdAt),
      capacityHUnits: capacity
    } as Container;
  }

  async findAll(): Promise<Container[]> {
    const result = await this.session.run(`MATCH (c:Container) RETURN c`);
    return result.records.map(r => {
      const c = r.get("c").properties;
      // Neo4j integers need to be converted to BigInt or number
      const capacity = c.capacityHUnits 
        ? (neo4j.isInt(c.capacityHUnits) ? c.capacityHUnits.toBigInt() : BigInt(c.capacityHUnits))
        : undefined;

      return { 
        ...c, 
        createdAt: new Date(c.createdAt),
        capacityHUnits: capacity
      } as Container;
    });
  }

  async getHeadState(containerId: string): Promise<ContainerState | null> {
    const result = await this.session.executeRead(async (tx) => {
      return await tx.run(
        `
        MATCH (c:Container {id: $containerId})
        OPTIONAL MATCH (c)-[:CURRENT_STATE]->(head:ContainerState)
        RETURN head, c
        `,
        { containerId }
      );
    });

    if (result.records.length === 0) return null;
    const record = result.records[0];
    const node = record.get("head");
    if (!node) return null;
    
    const c = record.get("c").properties;
    const s = node.properties;

    return {
      id: s.id,
      tenantId: s.tenantId,
      createdAt: new Date(s.createdAt),
      container: { ...c, createdAt: new Date(c.createdAt) } as Container,
      quantifiedComposition: {
        qty: neo4j.isInt(s.qty) ? s.qty.toBigInt() : BigInt(s.qty),
        unit: s.unit,
        attributes: deserializeAttributes(s.composition ?? "{}"),
      },
      timestamp: new Date(s.timestamp),
      flowsTo: [],
      flowsFrom: [],
    } as ContainerState;
  }

  async validateExistenceBatch(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    
    const result = await this.session.run(
      `
      UNWIND $ids as id
      MATCH (c:Container {id: id})
      RETURN collect(c.id) as foundIds
      `,
      { ids }
    );
    
    if (result.records.length === 0) return [];
    return result.records[0].get("foundIds") as string[];
  }
}
