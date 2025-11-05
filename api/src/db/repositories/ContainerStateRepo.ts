// db/repositories/ContainerStateRepo.ts
import { Session } from "neo4j-driver";
import { ContainerState } from "../../domain/ContainerState";

export class ContainerStateRepo {
  constructor(private session: Session) {}

  async create(state: ContainerState): Promise<void> {
    await this.session.run(
      `
      CREATE (s:ContainerState {
        id: $id,
        containerId: $containerId,
        operationId: $operationId,
        previousStateId: $previousStateId,
        volumeLiters: $volumeLiters,
        composition: $composition,
        timestamp: datetime($timestamp),
        tenantId: $tenantId,
        isCurrent: $isCurrent,
        isInitial: $isInitial
      })
      `,
      {
        ...state,
        timestamp: state.timestamp.toISOString(),
      }
    );
  }

  async findCurrentByContainer(containerId: string): Promise<ContainerState[]> {
    const result = await this.session.run(
      `
      MATCH (s:ContainerState {containerId: $containerId, isCurrent: true})
      RETURN s
      `,
      { containerId }
    );

    return result.records.map(r => {
      const s = r.get("s").properties;
      return { ...s, timestamp: new Date(s.timestamp) } as ContainerState;
    });
  }
}
