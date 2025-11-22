// src/config/starterData.ts
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { WineryOperation } from "../domain/nodes/WineryOperation";

export interface StarterData {
  containers: Container[];
  containerStates: ContainerState[];
  operations: WineryOperation[];
}

const containers: Container[] = [];
const containerStates: ContainerState[] = [];
const operations: WineryOperation[] = [];

const TENANT_ID = "winery1";
const ZERO_TIME = new Date("2024-01-01T00:00:00Z");

// Generate 10 Tanks
for (let i = 1; i <= 10; i++) {
  containers.push({
    id: `tank-${i}`,
    name: `Tank ${i}`,
    type: "tank",
    capacityHUnits: 100000000n, // 10,000 gal
    tenantId: TENANT_ID,
    createdAt: ZERO_TIME
  });
}

// Generate 40 Barrels
for (let i = 1; i <= 40; i++) {
  containers.push({
    id: `barrel-${i}`,
    name: `Barrel ${i}`,
    type: "barrel",
    capacityHUnits: 600000n, // 60 gal
    tenantId: TENANT_ID,
    createdAt: ZERO_TIME
  });
}

// Add Loss Container
containers.push({
    id: "loss-1",
    name: "Loss Container",
    type: "loss",
    tenantId: TENANT_ID,
    createdAt: ZERO_TIME
});

// Initial States for first 5 tanks
const varietals = ["Cabernet", "Merlot", "Pinot Noir", "Chardonnay", "Zinfandel"];
for (let i = 0; i < 5; i++) {
  const tankId = `tank-${i+1}`;
  const varietal = varietals[i];
  const qty = 50000000n; // 5,000 gal
  
  const container = containers.find(c => c.id === tankId)!;

  containerStates.push({
    id: `state-${tankId}-initial`,
    container: container,
    quantifiedComposition: {
      qty,
      unit: "gal",
      attributes: {
        varietal: { [varietal]: qty },
        vintage: { "2023": qty },
        county: { "Napa": qty },
        state: { "CA": qty },
        ava: { "Napa Valley": qty },
        realDollars: qty * 5n, // $5/gal
        nominalDollars: qty * 5n
      }
    },
    flowsTo: [],
    flowsFrom: [],
    timestamp: ZERO_TIME,
    tenantId: TENANT_ID,
    createdAt: ZERO_TIME
  });
}

export const starterData: StarterData = {
  containers,
  containerStates,
  operations
};