// Composition calculation helpers for domain operations
// These utilities calculate flow compositions using exact integer math with deterministic rounding

import { QuantifiedComposition } from '../domain/nodes/QuantifiedComposition';

type Attributes = {
  [key: string]: bigint | Attributes;
};

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
 * Distributes composition attributes across multiple flows using the "Physical First, Abstract Follows" model.
 * Ensures conservation: sum of flow attributes equals total attributes.
 *
 * Phase 1: Distribute physical attributes (varietals) to determine true flow quantities.
 * Phase 2: Distribute abstract attributes (cost) based on the true quantities.
 */
export function distributeComposition(
  fromComposition: QuantifiedComposition,
  flowRatioQtys: bigint[],
): QuantifiedComposition[] {
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
      if (amount > 0n) {
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

  // --- Phase 2: Distribute Abstract Attributes (cost, etc.) ---
  const abstractRatioQtys = finalFlowQtys;

  for (const [attrType, attrDict] of Object.entries(
    fromComposition.attributes,
  )) {
    if (attrType === 'varietal') {
      continue; // Already handled
    }

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
        abstractRatioQtys,
      );
      distributedAttr.forEach((amount, i) => {
        if (amount > 0n) {
          (flowCompositions[i].attributes[attrType] as Record<string, bigint>)[
            attrName
          ] = amount;
        }
      });
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

function _recursiveEqual(a: Attributes, b: Attributes): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
        const aValue = a[key];
        const bValue = b[key];

        if (typeof aValue === 'bigint' && typeof bValue === 'bigint') {
            if (aValue !== bValue) return false;
        } else if (typeof aValue === 'object' && aValue !== null && typeof bValue === 'object' && bValue !== null) {
            if (!_recursiveEqual(aValue as Attributes, bValue as Attributes)) return false;
        } else {
            return false; // Type mismatch
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