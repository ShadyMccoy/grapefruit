// db/repositories/ContainerStateRepo.ts
import neo4j, { Session } from "neo4j-driver";
import { ContainerState } from "../../domain/nodes/ContainerState";
import { Container } from "../../domain/nodes/Container";
import {
  serializeAttributes,
  deserializeAttributes,
} from "../../util/attributeSerialization";


export class ContainerStateRepo {
  constructor(private session: Session) {}

  async create(state: ContainerState): Promise<void> {
    await this.session.run(
      `
      MATCH (c:Container {id: $containerId})
      MERGE (s:ContainerState {id: $id})
      ON CREATE SET
        s.qty = $qty,
        s.unit = $unit,
        s.composition = $composition,
        s.timestamp = datetime($timestamp),
        s.tenantId = $tenantId,
        s.createdAt = datetime($createdAt),
        s.isHead = true
      MERGE (s)-[:STATE_OF]->(c)
      `,
      {
        id: state.id,
        qty: neo4j.int(state.quantifiedComposition.qty),
        unit: state.quantifiedComposition.unit,
        composition: serializeAttributes(state.quantifiedComposition.attributes),
        timestamp: state.timestamp.toISOString(),
        tenantId: state.tenantId,
        createdAt: state.createdAt.toISOString(),
        containerId: state.container.id,
      }
    );
  }

  async findById(id: string): Promise<ContainerState | null> {
    const result = await this.session.run(
      `
      MATCH (s:ContainerState {id: $id})-[:STATE_OF]->(c:Container)
      RETURN s, c
      `,
      { id }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const s = record.get("s").properties;
    const c = record.get("c").properties;

    return {
      id: s.id,
      tenantId: s.tenantId,
      createdAt: new Date(s.createdAt),
      timestamp: new Date(s.timestamp),
      container: { ...c, createdAt: new Date(c.createdAt) } as Container,
      quantifiedComposition: {
        qty: neo4j.isInt(s.qty) ? s.qty.toBigInt() : BigInt(s.qty),
        unit: s.unit,
        attributes: deserializeAttributes(s.composition ?? "{}"),
      },
      flowsTo: [],
      flowsFrom: [],
      isHead: s.isHead,
    } as ContainerState;
  }

  async findCurrentByContainer(containerId: string): Promise<ContainerState | null> {
    const result = await this.session.run(
      `
      MATCH (s:ContainerState)-[:STATE_OF]->(c:Container {id: $containerId})
      WHERE s.isHead = true
      RETURN s, c
      `,
      { containerId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const s = record.get("s").properties;
    const c = record.get("c").properties;

    return {
      id: s.id,
      tenantId: s.tenantId,
      createdAt: new Date(s.createdAt),
      timestamp: new Date(s.timestamp),
      container: { ...c, createdAt: new Date(c.createdAt) } as Container,
      quantifiedComposition: {
        qty: neo4j.isInt(s.qty) ? s.qty.toBigInt() : BigInt(s.qty),
        unit: s.unit,
        attributes: deserializeAttributes(s.composition ?? "{}"),
      },
      flowsTo: [],
      flowsFrom: [],
      isHead: s.isHead,
    } as ContainerState;
  }
}
