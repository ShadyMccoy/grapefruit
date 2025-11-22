// db/repositories/ContainerRepo.ts
import neo4j, { Session } from "neo4j-driver";
import { Container } from "../../domain/nodes/Container";
import { ContainerState } from "../../domain/nodes/ContainerState";
import { deserializeAttributes } from "../../util/attributeSerialization";
import { WineryOperation } from "../../domain/nodes/WineryOperation";

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

  async findById(id: string): Promise<(Container & { currentState?: ContainerState }) | null> {
    const result = await this.session.run(
      `MATCH (c:Container {id: $id}) 
       OPTIONAL MATCH (c)-[:CURRENT_STATE]->(s:ContainerState)
       RETURN c, s`,
      { id }
    );
    if (result.records.length === 0) return null;
    
    const r = result.records[0];
    const c = r.get("c").properties;
    const sNode = r.get("s");
    
    const capacity = c.capacityHUnits 
      ? (neo4j.isInt(c.capacityHUnits) ? c.capacityHUnits.toBigInt() : BigInt(c.capacityHUnits))
      : undefined;

    const container = { 
      ...c, 
      createdAt: new Date(c.createdAt),
      capacityHUnits: capacity
    } as Container;

    let currentState: ContainerState | undefined;
    if (sNode) {
      const s = sNode.properties;
      currentState = {
          id: s.id,
          tenantId: s.tenantId,
          createdAt: new Date(s.createdAt),
          container: container,
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

    return { ...container, currentState };
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<(Container & { currentState?: ContainerState })[]> {
    const result = await this.session.run(`
      MATCH (c:Container)
      OPTIONAL MATCH (c)-[:CURRENT_STATE]->(s:ContainerState)
      RETURN c, s
      ORDER BY c.id
      SKIP $offset
      LIMIT $limit
    `, {
      limit: neo4j.int(limit),
      offset: neo4j.int(offset)
    });
    return result.records.map(r => {
      const c = r.get("c").properties;
      const sNode = r.get("s");

      // Neo4j integers need to be converted to BigInt or number
      const capacity = c.capacityHUnits 
        ? (neo4j.isInt(c.capacityHUnits) ? c.capacityHUnits.toBigInt() : BigInt(c.capacityHUnits))
        : undefined;

      const container = { 
        ...c, 
        createdAt: new Date(c.createdAt),
        capacityHUnits: capacity
      } as Container;

      let currentState: ContainerState | undefined;
      if (sNode) {
        const s = sNode.properties;
        currentState = {
            id: s.id,
            tenantId: s.tenantId,
            createdAt: new Date(s.createdAt),
            container: container,
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

      return { ...container, currentState };
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

  async addBarrelToGroup(barrelId: string, groupId: string): Promise<void> {
    await this.session.run(
      `
      MATCH (b:Container {id: $barrelId})
      MATCH (g:Container {id: $groupId})
      MERGE (b)-[:MEMBER_OF]->(g)
      `,
      { barrelId, groupId }
    );
  }

  async removeBarrelFromGroup(barrelId: string, groupId: string): Promise<void> {
    await this.session.run(
      `
      MATCH (b:Container {id: $barrelId})-[r:MEMBER_OF]->(g:Container {id: $groupId})
      DELETE r
      `,
      { barrelId, groupId }
    );
  }

  async getGroupMembers(groupId: string): Promise<Container[]> {
    const result = await this.session.run(
      `
      MATCH (b:Container)-[:MEMBER_OF]->(g:Container {id: $groupId})
      RETURN b
      `,
      { groupId }
    );
    
    return result.records.map(r => {
      const c = r.get("b").properties;
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

  async getHistoryBatch(containerIds: string[]): Promise<WineryOperation[][]> {
    if (containerIds.length === 0) return [];
    
    const result = await this.session.run(
      `
      UNWIND $containerIds as cid
      MATCH (c:Container {id: cid})<-[:STATE_OF]-(s:ContainerState)
      MATCH (op:WineryOperation)-[:WINERY_OP_INPUT|WINERY_OP_OUTPUT]->(s)
      WITH cid, op
      ORDER BY op.createdAt DESC
      RETURN cid, collect(DISTINCT op) as ops
      `,
      { containerIds }
    );
    
    const map = new Map<string, WineryOperation[]>();
    result.records.forEach(r => {
       const ops = r.get('ops').map((opNode: any) => {
         const props = opNode.properties;
         return { ...props, createdAt: new Date(props.createdAt) };
       });
       map.set(r.get('cid'), ops);
    });
    
    return containerIds.map(id => map.get(id) || []);
  }
}
