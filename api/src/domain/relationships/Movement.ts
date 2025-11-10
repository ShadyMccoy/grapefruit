// src/domain/relationships/WineryOpRelationships.ts
import { ContainerState } from "../nodes/ContainerState";

// FLOW_TO relationship properties
export interface FlowToProps {
  qty: number;          // quantity flowing
  unit: "L" | "gal";
  deltaTime?: number;   // ΔT in seconds or minutes
  composition?: Record<string, number>; // varietal breakdown, etc.
}

export interface FlowToRelationship {
  from: Pick<ContainerState, "id">;
  to: Pick<ContainerState, "id">;
  properties: FlowToProps;
}
