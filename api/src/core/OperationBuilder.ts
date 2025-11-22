import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { WeighTag } from "../domain/nodes/VocabNodes";
import { distributeComposition, blendCompositions, scaleComposition, distributeInteger } from "./CompositionHelpers";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { OperationType } from "../domain/nodes/WineryOperation";

export type OperationInput = ContainerState;

export class OperationBuilder {
  static createOutputStates(params: {
    tenantId: string;
    createdAt: Date;
    fromContainers: OperationInput[];
  }): ContainerState[] {
    return params.fromContainers
      .map(state => ({
        id: crypto.randomUUID(),
        tenantId: params.tenantId,
        createdAt: params.createdAt,
        container: state.container,
        quantifiedComposition: state.quantifiedComposition,
        timestamp: params.createdAt,
        flowsTo: [],
        flowsFrom: []
      }));
  }

  static createFlows(
    params: {
      fromContainers: OperationInput[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint; unit?: string }[];
      inputConsumption?: { stateId: string; qty: bigint }[];
      targetFlowQuantities?: { containerId: string; qty: bigint; unit: string }[];
    },
    toContainers: ContainerState[],
    opType?: OperationType
  ): void {
    if (opType === 'press') {
      this.createPressFlows(params, toContainers);
    } else {
      this.createStandardFlows(params, toContainers);
    }
  }

  private static createStandardFlows(
    params: {
      fromContainers: OperationInput[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint; unit?: string }[];
      inputConsumption?: { stateId: string; qty: bigint }[];
      targetFlowQuantities?: { containerId: string; qty: bigint; unit: string }[];
    },
    toContainers: ContainerState[]
  ): void {
    // 1. Create explicit flows
    for (const flow of params.flowQuantities) {
      const fromState = params.fromContainers.find(s => s.id === flow.fromStateId);
      const toState = toContainers.find(s => s.container.id === flow.toStateId);
      if (fromState && toState) {
        fromState.flowsTo.push({
          from: { id: fromState.id },
          to: { id: toState.id },
          properties: {
            qty: flow.qty,
            unit: (flow.unit || fromState.quantifiedComposition.unit) as any,
            attributes: {}
          }
        });
        toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
      }
    }

    // 2. Create remainder flows (auto-balancing)
    for (const fromState of params.fromContainers) {
      let consumedQty = 0n;
      
      // Check if explicit consumption is defined
      const consumptionDef = params.inputConsumption?.find(c => c.stateId === fromState.id);
      if (consumptionDef) {
        consumedQty = consumptionDef.qty;
      } else {
        // Default: Sum of explicit output flows
        consumedQty = fromState.flowsTo.reduce((sum, f) => sum + f.properties.qty, 0n);
      }

      const remainder = fromState.quantifiedComposition.qty - consumedQty;
      
      if (remainder > 0n) {
        // Find the output state corresponding to this input container
        const toState = toContainers.find(s => s.container.id === fromState.container.id);
        if (toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: remainder,
              unit: fromState.quantifiedComposition.unit,
              attributes: {}
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }
    }
  }

  private static createPressFlows(
    params: {
      fromContainers: OperationInput[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint; unit?: string }[];
      inputConsumption?: { stateId: string; qty: bigint }[];
      targetFlowQuantities?: { containerId: string; qty: bigint; unit: string }[];
    },
    toContainers: ContainerState[]
  ): void {
    const weighTagInputs = params.fromContainers.filter(c => c.container.type === 'weighTag');
    const otherInputs = params.fromContainers.filter(c => c.container.type !== 'weighTag');

    // --- Part A: Handle Non-WeighTag Inputs (Standard Logic) ---
    // 1. Explicit Flows for Other Inputs
    for (const flow of params.flowQuantities) {
      const fromState = otherInputs.find(s => s.id === flow.fromStateId);
      if (fromState) {
        const toState = toContainers.find(s => s.container.id === flow.toStateId);
        if (toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: flow.qty,
              unit: (flow.unit || fromState.quantifiedComposition.unit) as any,
              attributes: {}
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }
    }

    // 2. Remainder Flows for Other Inputs
    for (const fromState of otherInputs) {
      let consumedQty = 0n;
      const consumptionDef = params.inputConsumption?.find(c => c.stateId === fromState.id);
      if (consumptionDef) {
        consumedQty = consumptionDef.qty;
      } else {
        consumedQty = fromState.flowsTo.reduce((sum, f) => sum + f.properties.qty, 0n);
      }

      const remainder = fromState.quantifiedComposition.qty - consumedQty;
      
      if (remainder > 0n) {
        const toState = toContainers.find(s => s.container.id === fromState.container.id);
        if (toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: remainder,
              unit: fromState.quantifiedComposition.unit,
              attributes: {}
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }
    }

    // --- Part B: Handle WeighTag Inputs (Homogenous Blending) ---
    // 1. Determine Consumed Qty per WeighTag
    const consumedMap = new Map<string, bigint>();
    let totalConsumedInput = 0n;

    for (const fromState of weighTagInputs) {
      let consumedQty = 0n;
      const consumptionDef = params.inputConsumption?.find(c => c.stateId === fromState.id);
      
      if (consumptionDef) {
        consumedQty = consumptionDef.qty;
      } else {
        consumedQty = fromState.quantifiedComposition.qty;
      }
      
      consumedMap.set(fromState.id, consumedQty);
      totalConsumedInput += consumedQty;
    }

    // 2. Determine Target Qty per Output (Only from WeighTag flows)
    const outputTargets = new Map<string, { qty: bigint, unit: string }>();
    
    // If targetFlowQuantities are provided, use them to determine output targets
    if (params.targetFlowQuantities && params.targetFlowQuantities.length > 0) {
        for (const target of params.targetFlowQuantities) {
            // Find the output state corresponding to the containerId
            const toState = toContainers.find(s => s.container.id === target.containerId);
            if (toState) {
                outputTargets.set(toState.container.id, { qty: target.qty, unit: target.unit });
            }
        }
    } else {
        // Fallback to explicit flowQuantities
        for (const flow of params.flowQuantities) {
            // Only consider flows originating from WeighTags
            if (weighTagInputs.some(wt => wt.id === flow.fromStateId)) {
                const current = outputTargets.get(flow.toStateId) || { qty: 0n, unit: flow.unit || 'gal' };
                current.qty += flow.qty;
                outputTargets.set(flow.toStateId, current);
            }
        }
    }
    
    // 3. Create M*N Flows (WeighTag -> Output)
    if (totalConsumedInput > 0n) {
      const inputIds = Array.from(consumedMap.keys());
      const inputWeights = inputIds.map(id => consumedMap.get(id)!);

      for (const [toStateId, target] of outputTargets.entries()) {
        const toState = toContainers.find(s => s.container.id === toStateId);
        if (!toState) continue;

        const distributedQtys = distributeInteger(target.qty, inputWeights);

        for (let i = 0; i < inputIds.length; i++) {
          const fromStateId = inputIds[i];
          const flowQty = distributedQtys[i];
          
          if (flowQty > 0n) {
            const fromState = weighTagInputs.find(s => s.id === fromStateId);
            if (fromState) {
              fromState.flowsTo.push({
                from: { id: fromState.id },
                to: { id: toState.id },
                properties: {
                  qty: flowQty,
                  unit: target.unit as any,
                  attributes: {}
                }
              });
              toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
            }
          }
        }
      }
    }

    // 4. Create Remainder Flows for WeighTags
    for (const fromState of weighTagInputs) {
      const consumedQty = consumedMap.get(fromState.id) || 0n;
      const remainder = fromState.quantifiedComposition.qty - consumedQty;

      if (remainder > 0n) {
        const toState = toContainers.find(s => s.container.id === fromState.container.id);
        if (toState) {
          fromState.flowsTo.push({
            from: { id: fromState.id },
            to: { id: toState.id },
            properties: {
              qty: remainder,
              unit: fromState.quantifiedComposition.unit,
              attributes: {}
            }
          });
          toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
        }
      }
    }
  }

  static assignFlowCompositions(fromContainers: OperationInput[], toContainers: ContainerState[], opType?: OperationType): void {
    for (const fromState of fromContainers) {
      const flows = fromState.flowsTo.map(f => {
        const toState = toContainers.find(c => c.id === f.to.id);
        // If we can't find the state (shouldn't happen), assume not loss.
        // Check container type for 'loss' or 'gain'
        const isLoss = toState?.container.type === 'loss';
        const isGain = toState?.container.type === 'gain';
        
        // Construct configuration for attribute distribution
        // Physical attributes (volume) always flow.
        // Cost (Real $) skips Loss and Gain (conserved).
        // Value (Nominal $) skips Loss (conserved), but flows to Gain (increases/decreases value).
        return {
          qty: f.properties.qty,
          accepts: {
            physical: true,
            cost: !isGain,
            value: !isLoss
          }
        };
      });

      let sourceComposition = fromState.quantifiedComposition;

      // Special handling for Press operations:
      // 1. Inject 'effectivePounds' if missing (from qty)
      // 2. Scale physical attributes to match total output flow quantity
      // Only apply this logic if the input is in Pounds (WeighTag)
      if (opType === 'press' && fromState.quantifiedComposition.unit === 'lbs') {
        const explicitFlows = fromState.flowsTo.filter(f => {
            const toState = toContainers.find(c => c.id === f.to.id);
            return toState && toState.container.id !== fromState.container.id;
        });
        const remainderFlows = fromState.flowsTo.filter(f => {
            const toState = toContainers.find(c => c.id === f.to.id);
            return toState && toState.container.id === fromState.container.id;
        });

        // Calculate total output quantity for explicit flows (Converted)
        const totalConvertedQty = explicitFlows.reduce((sum, f) => sum + f.properties.qty, 0n);
        
        // Inject effectivePounds if not present (using input qty)
        const attributes = { ...sourceComposition.attributes };
        if (typeof attributes.effectivePounds !== 'bigint') {
            attributes.effectivePounds = sourceComposition.qty;
        }
        const compositionWithPounds: QuantifiedComposition = {
            ...sourceComposition,
            attributes
        };

        // If we have remainder flows, we need to split the composition
        // The remainder flows get the "Remaining" portion (unscaled)
        // The explicit flows get the "Consumed" portion (scaled)
        
        // How much was consumed?
        // We can infer it from the remainder qty.
        // Remainder Qty is in Input Units (lbs).
        const remainderQty = remainderFlows.reduce((sum, f) => sum + f.properties.qty, 0n);
        const consumedQty = sourceComposition.qty - remainderQty;

        // Distribute composition into [Consumed, Remaining]
        const splitFlows = [
            { qty: consumedQty, accepts: { physical: true, cost: true, value: true } as any },
            { qty: remainderQty, accepts: { physical: true, cost: true, value: true } as any }
        ];
        
        const [consumedComp, remainingComp] = distributeComposition(compositionWithPounds, splitFlows);

        // Assign remaining composition to remainder flows
        if (remainderFlows.length > 0) {
            const remainderFlow = remainderFlows[0];
            remainderFlow.properties = remainingComp;
            remainderFlow.properties.unit = sourceComposition.unit;
        }

        // Scale consumed composition to explicit flows unit (gal)
        if (totalConvertedQty > 0n) {
            const targetUnit = explicitFlows[0]?.properties.unit || 'gal';
            const scaledConsumedComp = scaleComposition(consumedComp, totalConvertedQty, targetUnit as any);
            
            // Distribute scaled composition among explicit flows
            const explicitFlowConfigs = explicitFlows.map(f => ({
                qty: f.properties.qty,
                accepts: { physical: true, cost: true, value: true } as any
            }));
            
            const distributedExplicit = distributeComposition(scaledConsumedComp, explicitFlowConfigs);
            
            for (let i = 0; i < explicitFlows.length; i++) {
                explicitFlows[i].properties = distributedExplicit[i];
            }
        }
        
        // Skip the default distribution logic below
        continue;
      }

      const flowComps = distributeComposition(sourceComposition, flows);
      for (let i = 0; i < fromState.flowsTo.length; i++) {
        fromState.flowsTo[i].properties = flowComps[i]; // qty, unit, attributes
      }
    }
  }

  static assignOutputCompositions(toContainers: ContainerState[]): void {
    for (const toContainer of toContainers) {
      const incomingCompositions = toContainer.flowsFrom.map(flow => flow.properties);
      if (incomingCompositions.length > 0) {
        // If the container already has a quantity set (e.g. via outputQuantities override),
        // we should respect it?
        // blendCompositions calculates qty from sum of inputs.
        // For Press, the inputs (flows) are already scaled to the output unit/qty by assignFlowCompositions.
        // So blendCompositions should work correctly.
        toContainer.quantifiedComposition = blendCompositions(incomingCompositions);
      } else {
        // No incoming flows; set to zero composition
        toContainer.quantifiedComposition = {
          qty: 0n,
          unit: toContainer.quantifiedComposition.unit,
          attributes: {}
        };
      }
    }
  }
}
