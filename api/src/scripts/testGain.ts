import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Gain Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tankA", "Tank A", "tank");
    const gainContainer = await helper.createContainer("gainFound", "Found Wine", "gain");

    // Initial Tank State: 1000 gal, $100 Real, $100 Nominal
    const stateA = await helper.createState(tankA, 1000n, { "CAB": 1000n }, 10000n, 10000n);

    // Gain State: 100 gal, $0 Real, $10 Nominal (Value created!)
    const stateGain = await helper.createState(gainContainer, 100n, { "CAB": 100n }, 0n, 1000n);

    console.log("  🌱 Seeded initial states.");

    // 2. Operation: Gain 100 gal into Tank A
    const op = await WineryOperationService.buildWineryOperation({
      id: "gain_test_001",
      type: "adjustment",
      description: "Gain 100 gallons",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateGain],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankA.id, qty: 1000n },
        { fromStateId: stateGain.id, toStateId: tankA.id, qty: 100n }
      ]
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    
    // 3. Verification
    const outputState = result.outputStates?.find(s => s.container.id === "tankA");
    if (!outputState) throw new Error("Output state not found");

    const qty = outputState.quantifiedComposition.qty;
    const real = outputState.quantifiedComposition.attributes.realDollars;
    const nominal = outputState.quantifiedComposition.attributes.nominalDollars;

    console.log(`  📊 Result: Qty=${qty}, Real=$${real}, Nominal=$${nominal}`);

    if (qty !== 1100n) throw new Error(`Expected 1100 gal, got ${qty}`);
    if (real !== 10000n) throw new Error(`Expected $100.00 Real (conserved), got ${real}`);
    if (nominal !== 11000n) throw new Error(`Expected $110.00 Nominal (increased), got ${nominal}`);
});
