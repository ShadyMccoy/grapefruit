import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Dynamic Transfer Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tankA", "Tank A", "tank", 2000);
    const tankB = await helper.createContainer("tankB", "Tank B", "tank", 2000);

    const stateA = await helper.createState(tankA, 1000n, { "CHARD": 1000n });
    const stateB = await helper.createState(tankB, 800n, { "PINOT": 800n });

    console.log("  🌱 Seeded initial states.");

    // 2. Operation
    const qty = 50n;
    console.log(`  Building transfer operation dynamically (${qty} gal)...`);
    
    const op = await WineryOperationService.buildWineryOperation({
      id: "transfer_dynamic_001",
      type: "transfer",
      description: `Transfer ${qty} from tankA to tankB`,
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateB],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty },
      ],
    });

    console.log("  Creating operation...");
    const result = await WineryOperationService.validateAndCommitOperation(op);
    
    // 3. Verification
    const outA = result.outputStates?.find(s => s.container.id === "tankA");
    const outB = result.outputStates?.find(s => s.container.id === "tankB");

    if (!outA || !outB) throw new Error("Missing output states");

    console.log(`  Tank A: ${outA.quantifiedComposition.qty} (Expected 950)`);
    console.log(`  Tank B: ${outB.quantifiedComposition.qty} (Expected 850)`);

    if (outA.quantifiedComposition.qty !== 950n) throw new Error("Tank A qty incorrect");
    if (outB.quantifiedComposition.qty !== 850n) throw new Error("Tank B qty incorrect");
});
