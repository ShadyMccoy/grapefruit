// Composition calculation helpers for front-end
// These utilities help calculate flow compositions and validate operations

export interface Composition {
  varietals?: Record<string, number>;
  realDollars?: number;
  nominalDollars?: number;
}

export interface FlowSpec {
  from: number;
  to: number;
  qty: number;
  composition: Composition;
}

export interface ContainerState {
  qty: number;
  composition: Composition;
}

/**
 * Calculates the composition of a flow based on the input state and flow quantity.
 * Assumes homogeneous mixing within the container.
 */
export function calculateFlowComposition(
  inputState: ContainerState,
  flowQty: number
): Composition {
  if (flowQty === 0) {
    return { varietals: {}, realDollars: 0, nominalDollars: 0 };
  }

  const scale = flowQty / inputState.qty;

  return {
    varietals: inputState.composition.varietals ?
      Object.fromEntries(
        Object.entries(inputState.composition.varietals).map(
          ([varietal, amount]) => [varietal, amount * scale]
        )
      ) : undefined,
    realDollars: inputState.composition.realDollars ?
      inputState.composition.realDollars * scale : undefined,
    nominalDollars: inputState.composition.nominalDollars ?
      inputState.composition.nominalDollars * scale : undefined
  };
}

/**
 * Calculates the resulting composition when blending multiple flows.
 * Used to determine output container compositions.
 */
export function calculateBlendComposition(flows: FlowSpec[]): Composition {
  const totalQty = flows.reduce((sum, flow) => sum + flow.qty, 0);

  if (totalQty === 0) {
    return { varietals: {}, realDollars: 0, nominalDollars: 0 };
  }

  // Sum all compositions
  const summed: Composition = { varietals: {} };

  for (const flow of flows) {
    if (flow.composition.varietals) {
      for (const [varietal, amount] of Object.entries(flow.composition.varietals)) {
        summed.varietals![varietal] = (summed.varietals![varietal] || 0) + amount;
      }
    }
    if (flow.composition.realDollars !== undefined) {
      summed.realDollars = (summed.realDollars || 0) + flow.composition.realDollars;
    }
    if (flow.composition.nominalDollars !== undefined) {
      summed.nominalDollars = (summed.nominalDollars || 0) + flow.composition.nominalDollars;
    }
  }

  return summed;
}

/**
 * Validates that flow compositions are consistent with input states.
 * Checks quantity and composition conservation.
 */
export function validateFlows(
  inputStates: ContainerState[],
  flows: FlowSpec[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Group flows by input
  const flowsByInput = new Map<number, FlowSpec[]>();
  for (const flow of flows) {
    if (!flowsByInput.has(flow.from)) {
      flowsByInput.set(flow.from, []);
    }
    flowsByInput.get(flow.from)!.push(flow);
  }

  // Validate each input
  for (let inputIndex = 0; inputIndex < inputStates.length; inputIndex++) {
    const inputState = inputStates[inputIndex];
    const inputFlows = flowsByInput.get(inputIndex) || [];

    // If no flows from this input, skip validation (means no contribution)
    if (inputFlows.length === 0) {
      continue;
    }

    // Check quantity conservation
    const totalFlowQty = inputFlows.reduce((sum, flow) => sum + flow.qty, 0);
    if (Math.abs(totalFlowQty - inputState.qty) > 0.001) {
      errors.push(`Input ${inputIndex}: flow quantity sum ${totalFlowQty} ≠ input quantity ${inputState.qty}`);
    }

    // Check composition conservation
    const summedComposition = calculateBlendComposition(inputFlows);
    if (!compositionsEqual(summedComposition, inputState.composition)) {
      errors.push(`Input ${inputIndex}: flow compositions don't sum to input composition`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks if two compositions are equal within tolerance.
 */
export function compositionsEqual(a: Composition, b: Composition): boolean {
  // Compare varietals
  const aVarietals = Object.keys(a.varietals || {});
  const bVarietals = Object.keys(b.varietals || {});

  if (aVarietals.length !== bVarietals.length) return false;

  for (const varietal of aVarietals) {
    const aAmount = a.varietals![varietal] || 0;
    const bAmount = b.varietals![varietal] || 0;
    if (Math.abs(aAmount - bAmount) > 0.001) return false;
  }

  // Compare dollars
  if (Math.abs((a.realDollars || 0) - (b.realDollars || 0)) > 0.001) return false;
  if (Math.abs((a.nominalDollars || 0) - (b.nominalDollars || 0)) > 0.001) return false;

  return true;
}

/**
 * Generates flow specifications for a simple transfer operation.
 * From one container to another, with remaining amount staying in source.
 */
export function generateTransferFlows(
  fromState: ContainerState,
  toState: ContainerState,
  transferQty: number
): FlowSpec[] {
  const remainingQty = fromState.qty - transferQty;

  return [
    // Remaining in source container
    {
      from: 0,
      to: 0,
      qty: remainingQty,
      composition: calculateFlowComposition(fromState, remainingQty)
    },
    // Transferred to destination container
    {
      from: 0,
      to: 1,
      qty: transferQty,
      composition: calculateFlowComposition(fromState, transferQty)
    },
    // Existing in destination container
    {
      from: 1,
      to: 1,
      qty: toState.qty,
      composition: calculateFlowComposition(toState, toState.qty)
    }
  ];
}