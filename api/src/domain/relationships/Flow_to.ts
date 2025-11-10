// src/domain/relationships/WineryOpRelationships.ts
import { ContainerState, Composition } from "../nodes/ContainerState";

// FLOW_TO relationship properties
export interface FlowToProps {
  qty: number;          // quantity flowing
  unit: "gal" | "lbs" | "$";
  deltaTime?: number;   // ΔT in seconds or minutes
  composition?: Composition; // varietal breakdown, etc.
}

export interface FlowToRelationship {
  from: Pick<ContainerState, "id">;
  to: Pick<ContainerState, "id">;
  properties: FlowToProps;
}
