import { BaseNode } from "./BaseNode";
import { Container } from "./Container";

export interface ContainerState extends BaseNode {
  container: Container;
  qty: number; // Quantity in h-units (1 h-unit = 1/10,000 unit)
  unit: "gal" | "lbs" | "$"; // Unit of measure
  composition: Composition;
  timestamp: Date;
}

export interface Composition {
  varietals?: Record<string, number>; // e.g., { "chardonnay": 950, "pinot": 800 } - absolute amounts
  realDollars?: number;
  nominalDollars?: number;
}
