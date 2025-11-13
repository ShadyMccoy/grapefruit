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
      qty: 1000,
      unit: "gal",
      composition: { varietals: { chardonnay: 1000 }, realDollars: 5000, nominalDollars: 4800 },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
    },
    {
      id: "state_tankB_initial",
      container: { id: "tankB", name: "Tank B", type: "tank", capacityHUnits: 2113376, tenantId: "winery1", createdAt: new Date() },
      qty: 800,
      unit: "gal",
      composition: { varietals: { pinot: 800 }, realDollars: 4000, nominalDollars: 3900 },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
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
        { from: 0, to: 0, qty: 1000, unit: "gal", composition: { varietals: { chardonnay: 1000 }, realDollars: 5000, nominalDollars: 4800 } }, // 1000 gal from tankA to output 0
        { from: 1, to: 0, qty: 800, unit: "gal", composition: { varietals: { pinot: 800 }, realDollars: 4000, nominalDollars: 3900 } }  // 800 gal from tankB to output 0
      ],
      outputContainerId: "tankA", // Result goes to tankA
    },
  ],
};