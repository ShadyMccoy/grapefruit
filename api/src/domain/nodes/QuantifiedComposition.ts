// Shared payload interface for quantity, unit, and composition

export interface QuantifiedComposition {
  qty: number; // Quantity in h-units (1 h-unit = 1/10,000 unit)
  unit: "gal" | "lbs" | "$"; // Unit of measure
  varietals?: Record<string, number>; // e.g., { "chardonnay": 950, "pinot": 800 } - absolute amounts
  realDollars?: number;
  nominalDollars?: number;
}
