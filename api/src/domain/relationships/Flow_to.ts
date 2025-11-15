// src/domain/relationships/WineryOpRelationships.ts
import { ContainerState } from "../nodes/ContainerState";
import { QuantifiedComposition } from "../nodes/QuantifiedComposition";

export interface FlowToRelationship {
  from: Pick<ContainerState, "id">;
  to: Pick<ContainerState, "id">;
  properties: QuantifiedComposition & {
    deltaTime?: number;   // ΔT in seconds or minutes
  };
}
