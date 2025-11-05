// src/domain/relationships/Movement.ts
import { GraphRelationship } from "../types/GraphRelationship";
import { ContainerState } from "../nodes/ContainerState";
import { WineryOperation } from "../nodes/Operation";

export interface MovementProps {
  qtyLiters: number;
  unit: "L" | "gal";
  description?: string; // e.g. "Topping barrels 1–10"
}

export interface Movement {
  from: ContainerState;
  to: WineryOperation;
  properties: MovementProps;
}

export interface ResultedInProps {
  qtyLiters: number;
  unit: "L" | "gal";
}

/**
 * A ResultedIn connects a WineryOperation → ContainerState
 * representing material produced by an operation.
 */
export interface ResultedIn {
  from: WineryOperation;
  to: ContainerState;
  properties: ResultedInProps;
}