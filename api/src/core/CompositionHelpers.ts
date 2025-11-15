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
 * Calculates the resulting composition when blending multiple flows into an incoming state.
 * Used to determine output container compositions by merging the incoming state with all flows.
 */
export function calculateBlendComposition(
  IncomingState: ContainerState,
  IncomingFlows: QuantifiedComposition[]
): QuantifiedComposition {
  // Start with the incoming state's composition
  const result: QuantifiedComposition = {
    qty: IncomingState.quantifiedComposition.qty,
    unit: IncomingState.quantifiedComposition.unit,
    varietals: { ...IncomingState.quantifiedComposition.varietals },
    realDollars: IncomingState.quantifiedComposition.realDollars || 0,
    nominalDollars: IncomingState.quantifiedComposition.nominalDollars || 0
  };

  // Merge in all incoming flows
  for (const flow of IncomingFlows) {
    // Add quantity
    result.qty += flow.qty;

    // Merge varietals
    if (flow.varietals) {
      result.varietals = result.varietals || {};
      for (const [varietal, amount] of Object.entries(flow.varietals)) {
        result.varietals[varietal] = (result.varietals[varietal] || 0) + amount;
      }
    }

    // Add dollars
    if (flow.realDollars !== undefined) {
      result.realDollars = (result.realDollars || 0) + flow.realDollars;
    }
    if (flow.nominalDollars !== undefined) {
      result.nominalDollars = (result.nominalDollars || 0) + flow.nominalDollars;
    }
  }

  return result;
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
 * Generates quantified compositions for a transfer operation.
 * Calculates how to split a source composition into transferred and remaining portions.
 * 
 * Intent: Create balanced composition splits using deterministic rounding.
 * Returns array of [remaining composition, transferred composition]
 */
export function generateFlowCompositions(
  fromComposition: QuantifiedComposition,
  flows: FlowToRelationship[]
) : void {
  // Create a temporary ContainerState for calculation
  const tempState: ContainerState = {
    id: 'temp',
    tenantId: 'temp',
    createdAt: new Date(),
    timestamp: new Date(),
    container: { id: 'temp' } as any,
    quantifiedComposition: fromComposition
  };

  // Calculate compositions with integer division
  const transferredFromComp = calculateFlowComposition(tempState, -transferQty);
  const transferredToComp = calculateFlowComposition(tempState, transferQty);


  // Return negative flow and positive flow as full QuantifiedComposition objects
  return [
    {
      qty: -transferQty,
      unit: fromComposition.unit,
      varietals: transferredFromComp.varietals,
      realDollars: transferredFromComp.realDollars,
      nominalDollars: transferredFromComp.nominalDollars
    },
    {
      qty: transferQty,
      unit: fromComposition.unit,
      varietals: transferredToComp.varietals,
      realDollars: transferredToComp.realDollars,
      nominalDollars: transferredToComp.nominalDollars
    }
  ];
}