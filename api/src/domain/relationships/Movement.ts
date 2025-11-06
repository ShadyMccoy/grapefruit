// src/domain/relationships/WineryOpRelationships.ts
import { ContainerState } from "../nodes/ContainerState";
import { WineryOperation } from "../nodes/WineryOperation";

export interface WineryOpInputProps {
  qty: number;          // quantity contributed
  unit: "L" | "gal";
  description?: string; // optional note
}

export interface WineryOpInput {
  from: Pick<ContainerState, "id">; // only 'id' required for pretotype
  to?: Pick<WineryOperation, "id">; // optional, repo fills actual node
  properties: WineryOpInputProps;
}

export interface WineryOpOutputProps {
  qty: number;
  unit: "L" | "gal";
}

export interface WineryOpOutput {
  from?: Pick<WineryOperation, "id">;  // optional, repo fills actual node
  to: Pick<ContainerState, "id">;      // only 'id' required for pretotype
  properties: WineryOpOutputProps;
}
