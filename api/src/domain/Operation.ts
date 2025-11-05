// domain/Operation.ts
import { BaseNode } from "./BaseNode";
import { ContainerState } from "./ContainerState";

export type OperationType = "transfer" | "blend" | "bottle" | "loss" | "adjustment";

export interface Operation extends BaseNode {
  type: OperationType;
  description?: string;
  inputs: ContainerState[];
  outputs: ContainerState[];
}
