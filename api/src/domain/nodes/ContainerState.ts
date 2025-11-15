import { BaseNode } from "./BaseNode";
import { Container } from "./Container";
import { QuantifiedComposition } from "./QuantifiedComposition";

export interface ContainerState extends BaseNode {
  container: Container;
  quantifiedComposition: QuantifiedComposition;
  timestamp: Date;
}

// Re-export for use across codebase
export type { QuantifiedComposition };
