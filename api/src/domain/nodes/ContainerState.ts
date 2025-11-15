import { BaseNode } from "./BaseNode";
import { Container } from "./Container";
import { QuantifiedComposition, Composition } from "./QuantifiedComposition";

export interface ContainerState extends BaseNode, QuantifiedComposition {
  container: Container;
  timestamp: Date;
}

// Re-export for backward compatibility
export type { Composition, QuantifiedComposition };
