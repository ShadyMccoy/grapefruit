// domain/Container.ts
import { BaseNode } from "./BaseNode";

export interface Container extends BaseNode {
  name: string;
  type: "tank" | "barrel" | "bottle" | "loss" | "gain" | "weighTag" | "barrel-group";
  capacityHUnits?: bigint;
}
