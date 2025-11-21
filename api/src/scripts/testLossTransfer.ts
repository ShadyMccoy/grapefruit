import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Loss Transfer Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tankA", "Tank A", "tank");
    const tankB = await helper.createContainer("tankB", "Tank B", "tank");
    const lossContainer = await helper.createContainer("lossEvap", "Evaporation Loss", "loss");

    // Initial Tank State: 1000 gal, $100 Real, $100 Nominal
    const stateA = await helper.createState(tankA, 1000n, { "CAB": 1000n }, 10000n, 10000n);
    const stateB = await helper.createState(tankB, 0n);
    const stateLoss = await helper.createState(lossContainer, 0n);

    console.log("  🌱 Seeded initial states.");

    // 2. Operation: Transfer 500 gal to Tank B, 100 gal to Loss
    const op = await WineryOperationService.buildWineryOperation({
      id: "loss_test_001",
      type: "transfer",
      description: "Transfer with loss",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateB, stateLoss],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty: 500n },
        { fromStateId: stateA.id, toStateId: lossContainer.id, qty: 100n },
      ],
    });

    const result = await WineryOperationService.validateAndCommitOperation(op);
    
    // 3. Verification
    const outA = result.outputStates?.find(s => s.container.id === "tankA");
    const outB = result.outputStates?.find(s => s.container.id === "tankB");
    const outLoss = result.outputStates?.find(s => s.container.id === "lossEvap");

    if (!outA || !outB || !outLoss) throw new Error("Missing output states");

    console.log("\n  📊 Results:");
    console.log(`  Tank A: Qty=${outA.quantifiedComposition.qty}, Real=$${outA.quantifiedComposition.attributes.realDollars}, Nominal=$${outA.quantifiedComposition.attributes.nominalDollars}`);
    console.log(`  Tank B: Qty=${outB.quantifiedComposition.qty}, Real=$${outB.quantifiedComposition.attributes.realDollars}, Nominal=$${outB.quantifiedComposition.attributes.nominalDollars}`);
    console.log(`  Loss:   Qty=${outLoss.quantifiedComposition.qty}, Real=$${outLoss.quantifiedComposition.attributes.realDollars}, Nominal=$${outLoss.quantifiedComposition.attributes.nominalDollars}`);

    // Assertions
    // Real Dollars follow volume:
    // A: 400/1000 * 100 = 40
    // B: 500/1000 * 100 = 50
    // Loss: 100/1000 * 100 = 10
    if (outA.quantifiedComposition.attributes.realDollars !== 4000n) throw new Error("Tank A Real $ incorrect");
    if (outB.quantifiedComposition.attributes.realDollars !== 5000n) throw new Error("Tank B Real $ incorrect");
    if (outLoss.quantifiedComposition.attributes.realDollars !== 1000n) throw new Error("Loss Real $ incorrect");

    // Nominal Dollars skip Loss:
    // Total Non-Loss Vol = 900.
    // A: 400/900 * 100 = 44.44... (4444n)
    // B: 500/900 * 100 = 55.55... (5555n)
    // Loss: 0
    // Sum = 9999n (rounding error of 1 unit is acceptable in integer math, but let's see what CompositionHelpers does)
    
    // Actually, CompositionHelpers uses Largest Remainder Method, so it should sum to exactly 10000n.
    // 40000/9 = 4444.44 -> 4444
    // 50000/9 = 5555.55 -> 5555
    // Remainder = 1. Distributed to largest fraction? 
    // 0.55 > 0.44, so B gets +1? -> 5556.
    // Let's check.
});

