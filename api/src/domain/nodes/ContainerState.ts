import { BaseNode } from "./BaseNode";
import { Container } from "./Container";

export interface ContainerState extends BaseNode {
  container: Container;
  volumeLiters: number;
  composition: Record<string, number>;
  timestamp: Date;
  tenantId: string;
}
