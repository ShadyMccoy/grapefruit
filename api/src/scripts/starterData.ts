// src/config/starterData.ts
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { WineryOperation } from "../domain/nodes/WineryOperation";

export interface StarterData {
  containers: Container[];
  containerStates: ContainerState[];
  operations: WineryOperation[];
}

export const starterData: StarterData = {
  containers: [
    { id: "tankA", name: "Tank A", type: "tank", capacityHUnits: 2641720, tenantId: "winery1", createdAt: new Date() },
    { id: "tankB", name: "Tank B", type: "tank", capacityHUnits: 2113376, tenantId: "winery1", createdAt: new Date() },
    { id: "barrelA", name: "Barrel A", type: "barrel", capacityHUnits: 594156, tenantId: "winery1", createdAt: new Date() },
    { id: "barrelB", name: "Barrel B", type: "barrel", capacityHUnits: 594156, tenantId: "winery1", createdAt: new Date() },
    { id: "loss1", name: "Loss Container", type: "loss", tenantId: "winery1", createdAt: new Date() },
  ],
  containerStates: [
    {
      id: "state_tankA_initial",
      container: { id: "tankA", name: "Tank A", type: "tank", capacityHUnits: 2641720, tenantId: "winery1", createdAt: new Date() },
      quantifiedComposition: { qty: 1000n, unit: "gal", attributes: { varietals: { chardonnay: 1000n }, realDollars: 5000n, nominalDollars: 4800n } },
      flowsTo: [],
      flowsFrom: [],
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
    },
    {
      id: "state_tankB_initial",
      container: { id: "tankB", name: "Tank B", type: "tank", capacityHUnits: 2113376, tenantId: "winery1", createdAt: new Date() },
      quantifiedComposition: { qty: 800n, unit: "gal", attributes: { varietals: { pinot: 800n }, realDollars: 4000n, nominalDollars: 3900n } },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
      flowsTo: [],
      flowsFrom: [],
    },
  ],
  operations: [
    {
      id: "op_blend_1",
      type: "blend",
      description: "Blend Chardonnay and Pinot",
      tenantId: "winery1",
      createdAt: new Date(),
      inputStateIds: ["state_tankA_initial", "state_tankB_initial"],
      flows: [
        { from: {id: "state_tankA_initial"}, to: {id: "output0"}, properties: { qty: 1000n, unit: "gal", attributes: { varietals: { chardonnay: 1000n }, realDollars: 5000n, nominalDollars: 4800n } } }, // 1000 gal from tankA to output 0
        { from: {id: "state_tankB_initial"}, to: {id: "output0"}, properties: { qty: 800n, unit: "gal", attributes: { varietals: { pinot: 800n }, realDollars: 4000n, nominalDollars: 3900n } } }  // 800 gal from tankB to output 0
      ],
      outputContainerId: "tankA", // Result goes to tankA
    },
  ],
};