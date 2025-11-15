// Shared payload interface for quantity, unit, and composition
// Used by both ContainerState and FlowToRelationship to ensure uniform structure

export interface Composition {
  varietals?: Record<string, number>; // e.g., { "chardonnay": 950, "pinot": 800 } - absolute amounts
  realDollars?: number;
  nominalDollars?: number;
}

export interface QuantifiedComposition {
  qty: number; // Quantity in h-units (1 h-unit = 1/10,000 unit)
  unit: "gal" | "lbs" | "$"; // Unit of measure
  composition: Composition;
}
