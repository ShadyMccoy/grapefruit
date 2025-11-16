// Composition calculation helpers for domain operations
// These utilities calculate flow compositions using exact integer math with deterministic rounding

import { QuantifiedComposition } from "../domain/nodes/QuantifiedComposition";

/**
 * Distributes composition attributes across multiple flows using deterministic rounding.
 * Ensures conservation: sum of flow attributes equals total attributes.
 * 
 * Intent: Pure math function for proportional distribution with integer precision.
 * No knowledge of states or flows - just quantities and attributes.
 */
export function distributeComposition(
  fromComposition: QuantifiedComposition,
  flowQtys: bigint[]
): QuantifiedComposition[] {
  const flowCompositions: QuantifiedComposition[] = [];
  const totalQty = fromComposition.qty;
  const totalAttributes = fromComposition.attributes;

  // Initialize remaining qty and attributes
  let remainingQty = totalQty;
  let remainingAttributes = { ...totalAttributes };

  // Deep copy remainingAttributes for nested objects
  for (const [key, value] of Object.entries(remainingAttributes)) {
    if (typeof value === 'object') {
      remainingAttributes[key] = { ...value };
    }
  }

  // Iterate over flows, calculating each time with current remaining
  for (let i = 0; i < flowQtys.length; i++) {
    const flowQty = flowQtys[i] < 0n ? -flowQtys[i] : flowQtys[i]; // Absolute value

    // Calculate flow attributes proportionally
    const attributes: Record<string, bigint | Record<string, bigint>> = {};
    for (const [key, value] of Object.entries(remainingAttributes)) {
      if (typeof value === 'bigint') {
        const amount = (value * flowQty) / remainingQty;
        attributes[key] = amount;
        // Decrement remaining
        remainingAttributes[key] = value - amount;
      } else if (typeof value === 'object') {
        attributes[key] = {};
        const remainingObj = remainingAttributes[key] as Record<string, bigint>;
        for (const [subKey, subValue] of Object.entries(value)) {
          const amount = (subValue * flowQty) / remainingQty;
          (attributes[key] as Record<string, bigint>)[subKey] = amount;
          remainingObj[subKey] -= amount;
        }
      }
    }

    flowCompositions.push({
      qty: flowQty,
      unit: fromComposition.unit,
      attributes
    });

    // Decrement remaining qty
    remainingQty -= flowQty;
  }

  return flowCompositions;
}

/**
 * Blends multiple compositions into a single resulting composition.
 * Used for calculating output states from multiple inputs.
 */
export function blendCompositions(
  compositions: QuantifiedComposition[]
): QuantifiedComposition {
  if (compositions.length === 0) {
    throw new Error("Cannot blend empty compositions");
  }

  const result: QuantifiedComposition = {
    qty: 0n,
    unit: compositions[0].unit,
    attributes: {}
  };

  // Sum all quantities and attributes
  for (const comp of compositions) {
    result.qty += comp.qty;

    for (const [key, value] of Object.entries(comp.attributes)) {
      if (typeof value === 'bigint') {
        if (typeof result.attributes[key] === 'bigint') {
          result.attributes[key] += value;
        } else {
          result.attributes[key] = value;
        }
      } else if (typeof value === 'object') {
        if (!result.attributes[key] || typeof result.attributes[key] !== 'object') {
          result.attributes[key] = { ...value };
        } else {
          const existing = result.attributes[key] as Record<string, bigint>;
          for (const [subKey, subValue] of Object.entries(value)) {
            existing[subKey] = (existing[subKey] || 0n) + subValue;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Checks if two compositions are exactly equal (no tolerance).
 * Uses strict equality for integer h-units.
 */
export function compositionsEqual(a: QuantifiedComposition, b: QuantifiedComposition): boolean {
  if (a.qty !== b.qty || a.unit !== b.unit) return false;

  // Compare attributes
  const aKeys = Object.keys(a.attributes);
  const bKeys = Object.keys(b.attributes);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const aValue = a.attributes[key];
    const bValue = b.attributes[key];
    if (typeof aValue === 'bigint' && typeof bValue === 'bigint') {
      if (aValue !== bValue) return false;
    } else if (typeof aValue === 'object' && typeof bValue === 'object') {
      const aSubKeys = Object.keys(aValue);
      const bSubKeys = Object.keys(bValue);
      if (aSubKeys.length !== bSubKeys.length) return false;
      for (const subKey of aSubKeys) {
        if ((aValue as Record<string, bigint>)[subKey] !== (bValue as Record<string, bigint>)[subKey]) return false;
      }
    } else {
      return false; // type mismatch
    }
  }

  return true;
}