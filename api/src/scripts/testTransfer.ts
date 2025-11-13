// Test transfer operation
import { WineryOperationService } from "../core/WineryOperationService";
import { WineryOperation } from "../domain/nodes/WineryOperation";

async function testTransfer() {
  // Example transfer operation: move 50 gallons from tankA to tankB
  const transferOp: WineryOperation = {
    id: "transfer_test_001",
    type: "transfer",
    description: "Transfer 50 gallons from Tank A to Tank B",
    tenantId: "winery1",
    createdAt: new Date(),

    // Input states (current states of both containers)
    inputStateIds: ["state_tankA_initial", "state_tankB_initial"],

    // Output specifications (new states to create)
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_tankA_after_transfer",
        qty: 950, // 1000 - 50
        unit: "gal",
        composition: { varietals: { chardonnay: 950 }, realDollars: 4750, nominalDollars: 4560 } // Pure Chardonnay remaining
      },
      {
        containerId: "tankB",
        stateId: "state_tankB_after_transfer",
        qty: 850, // 800 + 50
        unit: "gal",
        composition: {
          varietals: { pinot: 800, chardonnay: 50 }, // Blend: ~94.1% Pinot, ~5.9% Chardonnay
          realDollars: 4250,  // 4000 + 250
          nominalDollars: 4150 // 3900 + 240
        }
      }
    ],

    // Flow specifications with compositions
    flows: [
      // tankA transfer 50 gal (100% Chardonnay being transferred)
      {
        from: 0,
        to: 1,
        qty: 50,
        unit: "gal",
        composition: { varietals: { chardonnay: 50 }, realDollars: 250, nominalDollars: 240 }
      },
      {
        from: 0,
        to: 0,
        qty: -50,
        unit: "gal",
        composition: { varietals: { chardonnay: -50 }, realDollars: -250, nominalDollars: -240 }
      },
      {
        from: 1,
        to: 1,
        qty: 0,
        unit: "gal",
        composition: { }
      }
    ]
  };

  try {
    console.log("Creating transfer operation...");
    const result = await WineryOperationService.createOperation(transferOp);
    console.log("Transfer operation created successfully:", result);
  } catch (error) {
    console.error("Transfer operation failed:", error);
  }
}

testTransfer();