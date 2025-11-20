import { FlowToRelationship } from "../relationships/Flow_to";
import { BaseNode } from "./BaseNode";
import { Container } from "./Container";
import { QuantifiedComposition } from "./QuantifiedComposition";

export interface ContainerState extends BaseNode {
  container: Container;
  quantifiedComposition: QuantifiedComposition;
  timestamp: Date;
  isHead: boolean;
  flowsTo: FlowToRelationship[];
  flowsFrom: FlowToRelationship[];
}

// Re-export for use across codebase
export type { QuantifiedComposition };
