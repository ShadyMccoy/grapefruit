// Composition calculation helpers for domain operations
// These utilities calculate flow compositions using exact integer math with deterministic rounding

import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";

/**
 * Calculates the composition of a flow based on the input state and flow quantity.
 * Uses integer division (floor) with remainder assignment to ensure conservation.
 * 
 * Intent: Proportionally distribute composition attributes across flows using deterministic rounding.
 * For each attribute: c = floor(C * q / Q), with remainder assigned to last flow.
 */
export function calculateFlowComposition(
  inputState: ContainerState,
  flowQty: number
): Partial<QuantifiedComposition> {
  if (flowQty === 0) {
    return { varietals: {}, realDollars: 0, nominalDollars: 0 };
  }

  const totalQty = inputState.quantifiedComposition.qty;
  const result: Partial<QuantifiedComposition> = { varietals: {} };

  // Calculate varietal amounts using integer division
  if (inputState.quantifiedComposition.varietals) {
    for (const [varietal, totalAmount] of Object.entries(inputState.quantifiedComposition.varietals)) {
      const flowAmount = Math.floor((totalAmount * Math.abs(flowQty)) / totalQty);
      result.varietals![varietal] = flowQty < 0 ? -flowAmount : flowAmount;
    }
  }

  // Calculate dollar amounts using integer division
  if (inputState.quantifiedComposition.realDollars !== undefined) {
    const flowDollars = Math.floor((inputState.quantifiedComposition.realDollars * Math.abs(flowQty)) / totalQty);
    result.realDollars = flowQty < 0 ? -flowDollars : flowDollars;
  }

  if (inputState.quantifiedComposition.nominalDollars !== undefined) {
    const flowDollars = Math.floor((inputState.quantifiedComposition.nominalDollars * Math.abs(flowQty)) / totalQty);
    result.nominalDollars = flowQty < 0 ? -flowDollars : flowDollars;
  }

  return result;
}

/**
 * Calculates the resulting composition when blending multiple flows.
 * Used to determine output container compositions.
 */
export function calculateBlendComposition(flows: FlowToRelationship[]): Partial<QuantifiedComposition> {
  const summed: Partial<QuantifiedComposition> = { varietals: {} };

  for (const flow of flows) {
    if (flow.properties.varietals) {
      for (const [varietal, amount] of Object.entries(flow.properties.varietals)) {
        summed.varietals![varietal] = (summed.varietals![varietal] || 0) + amount;
      }
    }
    if (flow.properties.realDollars !== undefined) {
      summed.realDollars = (summed.realDollars || 0) + flow.properties.realDollars;
    }
    if (flow.properties.nominalDollars !== undefined) {
      summed.nominalDollars = (summed.nominalDollars || 0) + flow.properties.nominalDollars;
    }
  }

  return summed;
}

/**
 * Checks if two compositions are exactly equal (no tolerance).
 * Uses strict equality for integer h-units.
 */
export function compositionsEqual(a: QuantifiedComposition, b: QuantifiedComposition): boolean {
  // Compare varietals
  const aVarietals = Object.keys(a.varietals || {});
  const bVarietals = Object.keys(b.varietals || {});

  if (aVarietals.length !== bVarietals.length) return false;

  for (const varietal of aVarietals) {
    const aAmount = a.varietals![varietal] || 0;
    const bAmount = b.varietals![varietal] || 0;
    if (aAmount !== bAmount) return false;
  }

  // Compare dollars
  if ((a.realDollars || 0) !== (b.realDollars || 0)) return false;
  if ((a.nominalDollars || 0) !== (b.nominalDollars || 0)) return false;

  return true;
}

/**
 * Generates flow specifications for a simple transfer operation.
 * From one container to another, with remaining amount staying in source.
 * 
 * Intent: Create balanced flows where net deltas from each input sum to zero.
 * Uses the iterative rounding method with remainder assignment to last flow.
 */
export function generateTransferFlows(
  fromState: ContainerState,
  toState: ContainerState,
  transferQty: number
): FlowToRelationship[] {
  const remainingQty = fromState.quantifiedComposition.qty - transferQty;

  // Calculate compositions with integer division
  const transferredComp = calculateFlowComposition(fromState, transferQty);
  const remainingComp = calculateFlowComposition(fromState, remainingQty);
  
  // Assign remainder to ensure exact conservation
  const totalRemainder: QuantifiedComposition = {
    qty: 0,
    unit: fromState.quantifiedComposition.unit,
    varietals: {},
    realDollars: 0,
    nominalDollars: 0
  };

  // Calculate what was allocated vs what should have been
  if (fromState.quantifiedComposition.varietals) {
    for (const [varietal, total] of Object.entries(fromState.quantifiedComposition.varietals)) {
      const allocated = (transferredComp.varietals?.[varietal] || 0) + (remainingComp.varietals?.[varietal] || 0);
      const remainder = total - allocated;
      if (remainder !== 0) {
        remainingComp.varietals = remainingComp.varietals || {};
        remainingComp.varietals[varietal] = (remainingComp.varietals[varietal] || 0) + remainder;
      }
    }
  }

  if (fromState.quantifiedComposition.realDollars !== undefined) {
    const allocated = (transferredComp.realDollars || 0) + (remainingComp.realDollars || 0);
    const remainder = fromState.quantifiedComposition.realDollars - allocated;
    remainingComp.realDollars = (remainingComp.realDollars || 0) + remainder;
  }

  if (fromState.quantifiedComposition.nominalDollars !== undefined) {
    const allocated = (transferredComp.nominalDollars || 0) + (remainingComp.nominalDollars || 0);
    const remainder = fromState.quantifiedComposition.nominalDollars - allocated;
    remainingComp.nominalDollars = (remainingComp.nominalDollars || 0) + remainder;
  }

  return [
    // Negative flow: amount leaving source
    {
      from: { id: fromState.id },
      to: { id: fromState.id },
      properties: {
        qty: -transferQty,
        unit: fromState.quantifiedComposition.unit,
        varietals: transferredComp.varietals ? Object.fromEntries(
          Object.entries(transferredComp.varietals).map(([k, v]) => [k, -v])
        ) : {},
        realDollars: -(transferredComp.realDollars || 0),
        nominalDollars: -(transferredComp.nominalDollars || 0)
      }
    },
    // Positive flow: amount arriving at destination
    {
      from: { id: fromState.id },
      to: { id: toState.id },
      properties: {
        qty: transferQty,
        unit: fromState.quantifiedComposition.unit,
        varietals: transferredComp.varietals,
        realDollars: transferredComp.realDollars,
        nominalDollars: transferredComp.nominalDollars
      }
    }
  ];
}