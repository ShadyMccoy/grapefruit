import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Tiny Tank Transfer Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tiny_tank_A", "Tiny Tank A", "tank", 10);
    const tankB = await helper.createContainer("tiny_tank_B", "Tiny Tank B", "tank", 10);

    const stateA = await helper.createState(tankA, 2n, { "CHARD": 1n, "PINOT": 1n });
    const stateB = await helper.createState(tankB, 0n);

    console.log("  🌱 Seeded initial states.");

    // 2. Operation
    const op = await WineryOperationService.buildWineryOperation({
      id: "transfer_tiny_tank_001",
      type: "transfer",
      description: "Transfer 1 h-unit from Tiny Tank A to Tiny Tank B",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateB],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty: 1n },
      ],
    });

    console.log("  Committing tiny tank transfer operation...");
    const result = await WineryOperationService.validateAndCommitOperation(op);
    
    // 3. Verification
    const outA = result.outputStates?.find(s => s.container.id === "tiny_tank_A");
    const outB = result.outputStates?.find(s => s.container.id === "tiny_tank_B");

    if (!outA || !outB) throw new Error("Missing output states");

    console.log(`  Tank A: ${outA.quantifiedComposition.qty} (Expected 1)`);
    console.log(`  Tank B: ${outB.quantifiedComposition.qty} (Expected 1)`);

    if (outA.quantifiedComposition.qty !== 1n) throw new Error("Tank A qty incorrect");
    if (outB.quantifiedComposition.qty !== 1n) throw new Error("Tank B qty incorrect");
});
