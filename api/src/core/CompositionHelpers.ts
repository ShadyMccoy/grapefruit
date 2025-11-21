// Composition calculation helpers for domain operations
// These utilities calculate flow compositions using exact integer math with deterministic rounding

import { QuantifiedComposition } from '../domain/nodes/QuantifiedComposition';

type Attributes = {
  [key: string]: bigint | Attributes;
};

/**
 * Attribute Classification:
 * - Physical Attributes: Directly tied to the physical substance (e.g., 'varietal').
 *   These are distributed first and determine the actual quantity of the flow.
 * - Abstract Attributes: Properties that follow the physical substance but don't define it (e.g., 'cost', 'dollars').
 *   These are distributed based on the ratios established by the physical distribution.
 */

/**
 * Distributes a single integer value using the Largest Remainder Method for fairness
 * while maintaining determinism.
 * @private
 */
function _distributeSingleAttribute(
  totalAttrValue: bigint,
  ratioQtys: bigint[],
  priorityOffset: number = 0,
): bigint[] {
  const totalRatioQty = ratioQtys.reduce((sum, qty) => sum + qty, 0n);

  if (totalRatioQty === 0n) {
    return new Array(ratioQtys.length).fill(0n);
  }

  // Use a larger integer base to avoid floating point math
  const SCALING_FACTOR = 10000n;
  const count = ratioQtys.length;

  const shares = ratioQtys.map((ratioQty, index) => {
    const idealShareScaled = (totalAttrValue * ratioQty * SCALING_FACTOR) / totalRatioQty;
    const floor = idealShareScaled / SCALING_FACTOR;
    const remainder = idealShareScaled % SCALING_FACTOR;
    return { index, floor, remainder };
  });

  const distributedValues = shares.map(s => s.floor);
  const allocatedSum = distributedValues.reduce((sum, v) => sum + v, 0n);
  let remainderUnits = totalAttrValue - allocatedSum;

  // Sort by remainder descending to find who gets the leftover units.
  // Add index as a tie-breaker for determinism, with rotation based on priorityOffset.
  shares.sort((a, b) => {
    if (a.remainder !== b.remainder) {
      return Number(b.remainder - a.remainder);
    }
    const aPriority = (a.index - priorityOffset + count) % count;
    const bPriority = (b.index - priorityOffset + count) % count;
    return aPriority - bPriority;
  });

  // Distribute the remainder units one by one
  for (let i = 0; i < remainderUnits; i++) {
    const winnerIndex = shares[i].index;
    distributedValues[winnerIndex]++;
  }

  return distributedValues;
}

/**
 * Configuration for how attributes should be distributed.
 * - 'physical': Follows the physical volume exactly (e.g., varietal).
 * - 'cost': Follows physical volume for standard containers, but skips loss/gain (conserved).
 * - 'value': Follows physical volume for standard/gain, but skips loss (conserved).
 */
export type AttributeCategory = 'physical' | 'cost' | 'value';

export const ATTRIBUTE_CATEGORIES: Record<string, AttributeCategory> = {
  'varietal': 'physical',
  'realDollars': 'cost',
  'nominalDollars': 'value'
};

export interface FlowDistributionConfig {
  qty: bigint;
  // Defines which attribute categories this flow accepts.
  // e.g., Loss container: { physical: true, financial: false }
  accepts: Record<AttributeCategory, boolean>;
}

/**
 * Distributes composition attributes across multiple flows using a category-based weighting model.
 * 
 * - Physical Attributes: Distributed based on flow quantity.
 * - Financial Attributes: Distributed based on flow quantity, but masked by the 'financial' acceptance flag.
 */
export function distributeComposition(
  fromComposition: QuantifiedComposition,
  flows: FlowDistributionConfig[],
): QuantifiedComposition[] {
  const flowRatioQtys = flows.map(f => f.qty);

  // --- Phase 1: Distribute Physical Attributes (varietals) ---
  const flowVarietals: Record<string, bigint>[] = flowRatioQtys.map(() => ({}));
  const sourceVarietals = (fromComposition.attributes.varietal ?? {}) as Record<
    string,
    bigint
  >;

  // Sort keys to ensure deterministic order for rotation
  const varietalKeys = Object.keys(sourceVarietals).sort();
  let attrIndex = 0;

  for (const varietalName of varietalKeys) {
    const totalVarietalQty = sourceVarietals[varietalName];
    const distributedVarietal = _distributeSingleAttribute(
      totalVarietalQty,
      flowRatioQtys,
      attrIndex,
    );
    attrIndex++;
    
    distributedVarietal.forEach((amount, i) => {
      if (amount !== 0n) {
        flowVarietals[i][varietalName] = amount;
      }
    });
  }

  // Calculate the true, final quantity of each flow by summing its varietals
  const finalFlowQtys = flowVarietals.map(varietals =>
    Object.values(varietals).reduce((sum, qty) => sum + qty, 0n),
  );

  const flowCompositions: QuantifiedComposition[] = finalFlowQtys.map(
    (finalQty, i) => ({
      qty: finalQty,
      unit: fromComposition.unit,
      attributes: { varietal: flowVarietals[i] },
    }),
  );

  // --- Phase 2: Distribute Other Attributes ---
  
  for (const [attrType, attrDict] of Object.entries(
    fromComposition.attributes,
  )) {
    if (attrType === 'varietal') {
      continue; // Already handled
    }

    // Determine the category for this attribute (default to physical if unknown)
    const category = ATTRIBUTE_CATEGORIES[attrType] || 'physical';

    // Calculate effective weights based on the flow's acceptance of this category
    // If a flow doesn't accept this category, its weight is 0.
    const ratioQtys = flows.map((f, i) => 
      f.accepts[category] ? finalFlowQtys[i] : 0n
    );

    // Handle scalar attributes (like nominalDollars often is) or nested objects
    if (typeof attrDict === 'bigint') {
        // Scalar attribute
        const distributedAttr = _distributeSingleAttribute(
            attrDict,
            ratioQtys
        );
        distributedAttr.forEach((amount, i) => {
            if (amount !== 0n) {
                flowCompositions[i].attributes[attrType] = amount;
            }
        });
    } else {
        // Nested object attribute (like cost breakdown)
        // Initialize container object for nested attributes
        flowCompositions.forEach(comp => {
          if (!comp.attributes[attrType]) {
            comp.attributes[attrType] = {};
          }
        });

        for (const [attrName, totalAttrQty] of Object.entries(
          attrDict as Record<string, bigint>,
        )) {
          const distributedAttr = _distributeSingleAttribute(
            totalAttrQty,
            ratioQtys,
          );
          distributedAttr.forEach((amount, i) => {
            if (amount !== 0n) {
              (flowCompositions[i].attributes[attrType] as Record<string, bigint>)[
                attrName
              ] = amount;
            }
          });
        }
    }
  }

  return flowCompositions;
}

function _recursiveBlend(target: Attributes, source: Attributes) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'bigint') {
      const existing = target[key];
      target[key] = (typeof existing === 'bigint' ? existing : 0n) + value;
    } else if (typeof value === 'object' && value !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      _recursiveBlend(target[key] as Attributes, value as Attributes);
    }
  }
}

/**
 * Blends multiple compositions into a single resulting composition.
 * Used for calculating output states from multiple inputs.
 */
export function blendCompositions(
  compositions: QuantifiedComposition[],
): QuantifiedComposition {
  if (compositions.length === 0) {
    throw new Error('Cannot blend empty compositions');
  }

  const result: QuantifiedComposition = {
    qty: 0n,
    unit: compositions[0].unit,
    attributes: {},
  };

  for (const comp of compositions) {
    result.qty += comp.qty;
    _recursiveBlend(result.attributes, comp.attributes);
  }

  return result;
}

function _isEmptyOrZero(attr: Attributes): boolean {
  for (const value of Object.values(attr)) {
    if (typeof value === 'bigint') {
      if (value !== 0n) return false;
    } else if (typeof value === 'object' && value !== null) {
      if (!_isEmptyOrZero(value as Attributes)) return false;
    }
  }
  return true;
}

function _recursiveEqual(a: Attributes, b: Attributes): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const aValue = a[key];
    const bValue = b[key];

    // Case 1: Both are BigInts
    if (typeof aValue === 'bigint' && typeof bValue === 'bigint') {
      if (aValue !== bValue) return false;
    }
    // Case 2: One is BigInt, other is missing (undefined)
    else if (typeof aValue === 'bigint' && bValue === undefined) {
      if (aValue !== 0n) return false;
    } else if (aValue === undefined && typeof bValue === 'bigint') {
      if (bValue !== 0n) return false;
    }
    // Case 3: Both are Objects
    else if (
      typeof aValue === 'object' &&
      aValue !== null &&
      typeof bValue === 'object' &&
      bValue !== null
    ) {
      if (!_recursiveEqual(aValue as Attributes, bValue as Attributes))
        return false;
    }
    // Case 4: One is Object, other is missing
    else if (
      typeof aValue === 'object' &&
      aValue !== null &&
      bValue === undefined
    ) {
      if (!_isEmptyOrZero(aValue as Attributes)) return false;
    } else if (
      aValue === undefined &&
      typeof bValue === 'object' &&
      bValue !== null
    ) {
      if (!_isEmptyOrZero(bValue as Attributes)) return false;
    }
    // Case 5: Type mismatch (e.g. BigInt vs Object)
    else {
      return false;
    }
  }
  return true;
}

/**
 * Checks if two compositions are exactly equal (no tolerance).
 * Uses strict equality for integer h-units.
 */
export function compositionsEqual(
  a: QuantifiedComposition,
  b: QuantifiedComposition,
): boolean {
  if (a.qty !== b.qty || a.unit !== b.unit) return false;
  return _recursiveEqual(a.attributes, b.attributes);
}