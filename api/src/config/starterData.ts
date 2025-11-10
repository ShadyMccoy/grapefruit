// src/config/starterData.ts
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { FlowToRelationship } from "../domain/relationships/Flow_to";

export interface StarterData {
  containers: Container[];
  containerStates: ContainerState[];
  operations: {
    operation: WineryOperation;
    inputStateIds: string[];
    outputStates: { containerId: string; stateId: string; qty: number; unit: "gal" | "lbs"; composition: any }[];
    flows: FlowToRelationship[];
  }[];
}

export const starterData: StarterData = {
  containers: [
    { id: "tank1", name: "Tank 1", type: "tank", capacityHUnits: 2641720, tenantId: "winery1", createdAt: new Date() },
    { id: "tank2", name: "Tank 2", type: "tank", capacityHUnits: 2113376, tenantId: "winery1", createdAt: new Date() },
    { id: "barrelA", name: "Barrel A", type: "barrel", capacityHUnits: 594156, tenantId: "winery1", createdAt: new Date() },
    { id: "barrelB", name: "Barrel B", type: "barrel", capacityHUnits: 594156, tenantId: "winery1", createdAt: new Date() },
    { id: "loss1", name: "Loss Container", type: "loss", tenantId: "winery1", createdAt: new Date() },
  ],
  containerStates: [
    {
      id: "state_tank1_initial",
      container: { id: "tank1", name: "Tank 1", type: "tank", capacityHUnits: 2641720, tenantId: "winery1", createdAt: new Date() },
      qty: 1000,
      unit: "gal",
      composition: { varietals: { chardonnay: 1.0 }, realDollars: 5000, nominalDollars: 4800 },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
    },
    {
      id: "state_tank2_initial",
      container: { id: "tank2", name: "Tank 2", type: "tank", capacityHUnits: 2113376, tenantId: "winery1", createdAt: new Date() },
      qty: 800,
      unit: "gal",
      composition: { varietals: { pinot: 1.0 }, realDollars: 4000, nominalDollars: 3900 },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date(),
    },
  ],
  operations: [
    {
      operation: {
        id: "op_blend_1",
        type: "blend",
        description: "Blend Chardonnay and Pinot",
        tenantId: "winery1",
        createdAt: new Date(),
      },
      inputStateIds: ["state_tank1_initial", "state_tank2_initial"],
      outputStates: [
        {
          containerId: "tank1",
          stateId: "state_blend_output",
          qty: 1800,
          unit: "gal",
          composition: { varietals: { chardonnay: 0.556, pinot: 0.444 }, realDollars: 9000, nominalDollars: 8700 },
        },
      ],
      flows: [
        {
          from: { id: "state_tank1_initial" },
          to: { id: "state_blend_output" },
          properties: { qty: 1000, unit: "gal", composition: { varietals: { chardonnay: 1.0 } } },
        },
        {
          from: { id: "state_tank2_initial" },
          to: { id: "state_blend_output" },
          properties: { qty: 800, unit: "gal", composition: { varietals: { pinot: 1.0 } } },
        },
      ],
    },
  ],
};