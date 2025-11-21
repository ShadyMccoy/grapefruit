import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Transfer Sequence Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tankA", "Tank A", "tank", 2000);
    const tankB = await helper.createContainer("tankB", "Tank B", "tank", 2000);

    const stateA = await helper.createState(tankA, 1000n, { "CHARD": 1000n });
    const stateB = await helper.createState(tankB, 800n, { "PINOT": 800n });

    console.log("  🌱 Seeded initial states.");

    // 2. Op 1: 50 gal A -> B
    console.log("  Executing Op 1: 50 gal A -> B...");
    const op1 = await WineryOperationService.buildWineryOperation({
      id: "transfer_seq_001",
      type: "transfer",
      description: "Seq1: 50 A->B",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateB],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty: 50n },
      ],
    });

    const res1 = await WineryOperationService.validateAndCommitOperation(op1);
    const stateA1 = res1.outputStates?.find(s => s.container.id === "tankA");
    const stateB1 = res1.outputStates?.find(s => s.container.id === "tankB");

    if (!stateA1 || !stateB1) throw new Error("Op1 output states missing");
    console.log(`  A1: ${stateA1.quantifiedComposition.qty} (Expected 950)`);
    console.log(`  B1: ${stateB1.quantifiedComposition.qty} (Expected 850)`);

    if (stateA1.quantifiedComposition.qty !== 950n) throw new Error("A1 Qty incorrect");
    if (stateB1.quantifiedComposition.qty !== 850n) throw new Error("B1 Qty incorrect");

    // 3. Op 2: 100 gal B -> A
    console.log("  Executing Op 2: 100 gal B -> A...");
    const op2 = await WineryOperationService.buildWineryOperation({
      id: "transfer_seq_002",
      type: "transfer",
      description: "Seq2: 100 B->A",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA1, stateB1],
      flowQuantities: [
        { fromStateId: stateB1.id, toStateId: tankA.id, qty: 100n },
      ],
    });

    const res2 = await WineryOperationService.validateAndCommitOperation(op2);
    const stateA2 = res2.outputStates?.find(s => s.container.id === "tankA");
    const stateB2 = res2.outputStates?.find(s => s.container.id === "tankB");

    if (!stateA2 || !stateB2) throw new Error("Op2 output states missing");
    console.log(`  A2: ${stateA2.quantifiedComposition.qty} (Expected 1050)`);
    console.log(`  B2: ${stateB2.quantifiedComposition.qty} (Expected 750)`);

    if (stateA2.quantifiedComposition.qty !== 1050n) throw new Error("A2 Qty incorrect");
    if (stateB2.quantifiedComposition.qty !== 750n) throw new Error("B2 Qty incorrect");
});
