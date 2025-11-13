import { BaseNode } from "./BaseNode";
import { ContainerState, Composition } from "./ContainerState";

export type OperationType =
  | "transfer"
  | "blend"
  | "bottle"
  | "loss"
  | "adjustment"
  | "press"
  | "gain";

export interface WineryOperation extends BaseNode {
  type: OperationType;
  description?: string;

  // Operation execution data (required for creation)
  inputStateIds?: string[];
  outputSpecs?: OutputSpec[]; // Multiple outputs supported
  flows?: FlowSpec[]; // Flows from inputs to outputs

  // Legacy single-output support (for backward compatibility)
  outputContainerId?: string; // DEPRECATED: Use outputSpecs instead

  // Related states (populated when querying, not required for creation)
  inputStates?: ContainerState[];
  outputStates?: ContainerState[];
  lossState?: ContainerState;
}

export interface OutputSpec {
  containerId: string;
  stateId: string; // Front-end assigned UUID
  qty: number;
  unit: "gal" | "lbs" | "$";
  composition: Composition;
}

export interface FlowSpec {
  from: number; // Index into inputStateIds
  to: number;   // Index into outputSpecs
  qty: number;
  unit: "gal" | "lbs" | "$"; // Unit of measure for the flow
  composition: Composition; // The specific composition portion being transferred
  deltaTime?: number; // Optional time delta in seconds
}

