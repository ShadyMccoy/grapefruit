// db/repositories/ContainerStateRepo.ts
import { Session } from "neo4j-driver";
import { ContainerState } from "../../domain/nodes/ContainerState";
import { Container } from "../../domain/nodes/Container";

export class ContainerStateRepo {
  constructor(private session: Session) {}

  async create(state: ContainerState): Promise<void> {
    await this.session.run(
      `
      MATCH (c:Container {id: $containerId})
      CREATE (s:ContainerState {
        id: $id,
        qty: $qty,
        unit: $unit,
        composition: $composition,
        timestamp: datetime($timestamp),
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })-[:STATE_OF]->(c)
      `,
      {
        id: state.id,
        qty: state.quantifiedComposition.qty,
        unit: state.quantifiedComposition.unit,
        composition: JSON.stringify(state.quantifiedComposition.attributes),
        timestamp: state.timestamp.toISOString(),
        tenantId: state.tenantId,
        createdAt: state.createdAt.toISOString(),
        containerId: state.container.id,
      }
    );
  }

  async findCurrentByContainer(containerId: string): Promise<ContainerState[]> {
    const result = await this.session.run(
      `
      MATCH (s:ContainerState)-[:STATE_OF]->(c:Container {id: $containerId})
      WHERE s.isCurrent = true
      RETURN s, c
      `,
      { containerId }
    );

    return result.records.map(r => {
      const s = r.get("s").properties;
      const c = r.get("c").properties;
      const comp = s.composition ? JSON.parse(s.composition) : {};
      return {
        id: s.id,
        tenantId: s.tenantId,
        createdAt: new Date(s.createdAt),
        timestamp: new Date(s.timestamp),
        container: { ...c, createdAt: new Date(c.createdAt) } as Container,
        quantifiedComposition: {
          qty: s.qty,
          unit: s.unit,
          attributes: comp
        }
      } as ContainerState;
    });
  }
}
