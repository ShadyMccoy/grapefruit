import { FlowToRelationship } from "../relationships/Flow_to";
import { BaseNode } from "./BaseNode";
import { ContainerState, QuantifiedComposition } from "./ContainerState";

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

  // Related states (populated when querying, not required for creation)
  inputStates?: ContainerState[];
  flows?: FlowToRelationship[];
  outputStates?: ContainerState[];
  lossState?: ContainerState;
}

