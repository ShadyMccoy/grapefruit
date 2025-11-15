// src/domain/relationships/WineryOpRelationships.ts
import { ContainerState } from "../nodes/ContainerState";
import { QuantifiedComposition } from "../nodes/QuantifiedComposition";

// FLOW_TO relationship properties
export interface FlowToProps extends QuantifiedComposition {
  deltaTime?: number;   // ΔT in seconds or minutes
}

export interface FlowToRelationship {
  from: Pick<ContainerState, "id">;
  to: Pick<ContainerState, "id">;
  properties: FlowToProps;
}
