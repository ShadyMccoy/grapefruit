// Shared payload interface for quantity, unit, and composition

export interface QuantifiedComposition {
  qty: bigint; // Quantity in h-units (1 h-unit = 1/10,000 unit) - integer
  unit: "gal" | "lbs" | "$"; // Unit of measure
  attributes: Record<string, bigint | Record<string, bigint>>; // Extensible attributes: varietals, vintage, dollars, etc. - all integers
}
