import { ContainerState, QuantifiedComposition } from "../domain/nodes/ContainerState";
import { distributeComposition, blendCompositions } from "./CompositionHelpers";

export class OperationBuilder {
  static createOutputStates(params: {
    tenantId: string;
    createdAt: Date;
    fromContainers: ContainerState[];
  }): ContainerState[] {
    return params.fromContainers.map(state => ({
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
      fromContainers: ContainerState[];
      flowQuantities: { fromStateId: string; toStateId: string; qty: bigint }[];
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
            unit: fromState.quantifiedComposition.unit,
            attributes: {}
          }
        });
        toState.flowsFrom.push(fromState.flowsTo[fromState.flowsTo.length - 1]);
      }
    }

    // 2. Create remainder flows (auto-balancing)
    for (const fromState of params.fromContainers) {
      const explicitOutQty = fromState.flowsTo.reduce((sum, f) => sum + f.properties.qty, 0n);
      const remainder = fromState.quantifiedComposition.qty - explicitOutQty;
      
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

  static assignFlowCompositions(fromContainers: ContainerState[], toContainers: ContainerState[]): void {
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

      const flowComps = distributeComposition(fromState.quantifiedComposition, flows);
      for (let i = 0; i < fromState.flowsTo.length; i++) {
        fromState.flowsTo[i].properties = flowComps[i]; // qty, unit, attributes
      }
    }
  }

  static assignOutputCompositions(toContainers: ContainerState[]): void {
    for (const toContainer of toContainers) {
      const incomingCompositions = toContainer.flowsFrom.map(flow => flow.properties);
      if (incomingCompositions.length > 0) {
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
