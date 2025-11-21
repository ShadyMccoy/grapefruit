import { WineryOperationService } from "../core/WineryOperationService";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Gain -> Loss Sequence Test", async (session, helper) => {
    // 1. Setup
    const tankA = await helper.createContainer("tankA", "Tank A", "tank");
    const gainContainer = await helper.createContainer("gainFound", "Found Wine", "gain");
    const lossContainer = await helper.createContainer("lossEvap", "Evaporation", "loss");

    // Initial Tank State (A0): 1000 gal, $100 Real, $100 Nominal
    const stateA0 = await helper.createState(tankA, 1000n, { "CAB": 1000n }, 10000n, 10000n);
    
    // Gain State: 100 gal, $0 Real, $10 Nominal
    const stateGain = await helper.createState(gainContainer, 100n, { "CAB": 100n }, 0n, 1000n);

    console.log("  🌱 Seeded initial states.");

    // --- Step 1: Gain 100 gal ---
    console.log("  Executing Step 1: Gain 100 gal...");
    const op1 = await WineryOperationService.buildWineryOperation({
      id: "op_gain",
      type: "adjustment",
      description: "Gain 100 gallons",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA0, stateGain],
      flowQuantities: [
        { fromStateId: stateGain.id, toStateId: tankA.id, qty: 100n },
      ],
    });

    const res1 = await WineryOperationService.validateAndCommitOperation(op1);
    const stateA1 = res1.outputStates?.find(s => s.container.id === "tankA");
    if (!stateA1) throw new Error("State A1 missing");

    console.log(`  A1: Qty=${stateA1.quantifiedComposition.qty}, Real=$${stateA1.quantifiedComposition.attributes.realDollars}, Nominal=$${stateA1.quantifiedComposition.attributes.nominalDollars}`);
    
    if (stateA1.quantifiedComposition.qty !== 1100n) throw new Error("A1 Qty incorrect");
    if (stateA1.quantifiedComposition.attributes.realDollars !== 10000n) throw new Error("A1 Real $ incorrect");
    if (stateA1.quantifiedComposition.attributes.nominalDollars !== 11000n) throw new Error("A1 Nominal $ incorrect");

    // --- Step 2: Loss 100 gal ---
    console.log("  Executing Step 2: Loss 100 gal...");
    
    // Need to fetch the loss state (empty) for the operation input
    const stateLoss = await helper.createState(lossContainer, 0n);

    const op2 = await WineryOperationService.buildWineryOperation({
      id: "op_loss",
      type: "transfer",
      description: "Loss 100 gallons",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA1, stateLoss],
      flowQuantities: [
        { fromStateId: stateA1.id, toStateId: lossContainer.id, qty: 100n },
      ],
    });

    const res2 = await WineryOperationService.validateAndCommitOperation(op2);
    const stateA2 = res2.outputStates?.find(s => s.container.id === "tankA");
    const stateLossOut = res2.outputStates?.find(s => s.container.id === "lossEvap");

    if (!stateA2 || !stateLossOut) throw new Error("Output states missing");

    console.log(`  A2: Qty=${stateA2.quantifiedComposition.qty}, Real=$${stateA2.quantifiedComposition.attributes.realDollars}, Nominal=$${stateA2.quantifiedComposition.attributes.nominalDollars}`);
    console.log(`  Loss: Qty=${stateLossOut.quantifiedComposition.qty}, Real=$${stateLossOut.quantifiedComposition.attributes.realDollars}, Nominal=$${stateLossOut.quantifiedComposition.attributes.nominalDollars}`);

    // Assertions
    // Qty: 1100 - 100 = 1000
    if (stateA2.quantifiedComposition.qty !== 1000n) throw new Error("A2 Qty incorrect");

    // Real $: Proportional loss. 100/1100 lost.
    // 10000 * (1000/1100) = 9090.9 -> 9091n
    // Loss gets 10000 * (100/1100) = 909.09 -> 909n
    // Sum = 10000n.
    if (stateA2.quantifiedComposition.attributes.realDollars !== 9091n) throw new Error(`A2 Real $ incorrect. Got ${stateA2.quantifiedComposition.attributes.realDollars}`);
    
    // Nominal $: Conserved.
    // 11000n.
    if (stateA2.quantifiedComposition.attributes.nominalDollars !== 11000n) throw new Error(`A2 Nominal $ incorrect. Got ${stateA2.quantifiedComposition.attributes.nominalDollars}`);
});
