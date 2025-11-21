import { OperationBuilder } from "../core/OperationBuilder";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { QuantifiedComposition } from "../domain/nodes/QuantifiedComposition";
import { ContainerState } from "../domain/nodes/ContainerState";
import { blendCompositions, distributeComposition } from "../core/CompositionHelpers";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Complex Transfer Test (Pre-Gain, Post-Loss)", async (session, helper) => {
    // 1. Setup: Tank A (1000), Tank B (1000), GainNode, LossNode
    const tankA = await helper.createContainer("tankA", "Tank A", "tank");
    const tankB = await helper.createContainer("tankB", "Tank B", "tank");
    const gainNode = await helper.createContainer("gainNode", "Gain Node", "gain");
    const lossNode = await helper.createContainer("lossNode", "Loss Node", "loss");

    const stateRepo = new ContainerStateRepo(session);

    // Initial States
    // A0: 1000 gal, $1000 Real, $1000 Nominal
    const a0Comp: QuantifiedComposition = {
        qty: 10000000n,
        unit: "gal",
        attributes: { varietal: { "CAB": 10000000n }, realDollars: 10000000n, nominalDollars: 10000000n }
    };
    const stateA0: ContainerState = {
        id: crypto.randomUUID(), tenantId: "winery1", createdAt: new Date(), container: tankA,
        quantifiedComposition: a0Comp, timestamp: new Date(), flowsTo: [], flowsFrom: []
    };

    // B0: 1000 gal, $2000 Real, $2000 Nominal (Different cost/value)
    const b0Comp: QuantifiedComposition = {
        qty: 10000000n,
        unit: "gal",
        attributes: { varietal: { "MERLOT": 10000000n }, realDollars: 20000000n, nominalDollars: 20000000n }
    };
    const stateB0: ContainerState = {
        id: crypto.randomUUID(), tenantId: "winery1", createdAt: new Date(), container: tankB,
        quantifiedComposition: b0Comp, timestamp: new Date(), flowsTo: [], flowsFrom: []
    };

    await stateRepo.create(stateA0);
    await stateRepo.create(stateB0);

    console.log("  🌱 Seeded initial states.");

    // 2. Operation Logic
    // Transfer 500 gal A -> B.
    // Pre-Check A: Measured 1001 (+1 Gain).
    // Post-Check B: Measured 1498 (-2 Loss).

    // Step 2a: Calculate Pre-Gain Flow (A0 -> Gain)
    // A0 is 1000. Measured 1001.
    // We need A0 to behave like 1001.
    // Flows from A0:
    // - To B: 500
    // - To A1: 501 (Remainder)
    // - To Gain: -1
    // Sum = 1000. Correct.

    // Step 2b: Calculate Post-Loss Flow (Loss -> B1)
    // Inputs to B1:
    // - From A0: 500
    // - From B0: 1000
    // Expected B1 = 1500.
    // Measured B1 = 1498.
    // We need a flow of -2 into B1.
    // Source: LossNode?
    // Composition: Must be the blend of (A0_part + B0).
    
    // Calculate the "Ideal" Blend first to get the composition for the negative flow
    // We need 500 gal from A0 and 1000 gal from B0.
    // A0 is 1000. We need half.
    const flowFromA = distributeComposition(stateA0.quantifiedComposition, [
        { qty: 5000000n, accepts: { physical: true, cost: true, value: true } },
        { qty: 5000000n, accepts: { physical: true, cost: true, value: true } } // Remainder
    ])[0];
    
    // B0 is 1000. We need all.
    const flowFromB = distributeComposition(stateB0.quantifiedComposition, [
        { qty: 10000000n, accepts: { physical: true, cost: true, value: true } }
    ])[0];
    
    const idealBlend = blendCompositions([flowFromA, flowFromB]); // 1500 gal
    
    // Create the Negative Flow Composition (scaled down ideal blend)
    // -2 gal. We use a dummy remainder flow to force the scaling.
    // Total Blend = 1500. Target = -2. Remainder = 1502.
    const lossQty = -20000n;
    const remainderQty = idealBlend.qty - lossQty; // 1500 - (-2) = 1502
    
    const distributedLoss = distributeComposition(idealBlend, [
        { qty: lossQty, accepts: { physical: true, cost: true, value: true } },
        { qty: remainderQty, accepts: { physical: true, cost: true, value: true } }
    ]);
    const lossFlowComp = distributedLoss[0];

    // Create a dummy state for LossNode to act as source
    const stateLossSource: ContainerState = {
        id: crypto.randomUUID(), tenantId: "winery1", createdAt: new Date(), container: lossNode,
        quantifiedComposition: lossFlowComp, // It provides this negative composition
        timestamp: new Date(), flowsTo: [], flowsFrom: []
    };

    // 3. Build Operation
    const outputStates = OperationBuilder.createOutputStates({
        tenantId: "winery1", createdAt: new Date(), fromContainers: [stateA0, stateB0]
    });
    const stateA1 = outputStates[0];
    const stateB1 = outputStates[1];

    // Dummy Gain State (Sink)
    const stateGainSink: ContainerState = {
        id: crypto.randomUUID(), tenantId: "winery1", createdAt: new Date(), container: gainNode,
        quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} }, timestamp: new Date(), flowsTo: [], flowsFrom: []
    };

    const allSources = [stateA0, stateB0, stateLossSource];
    const allDests = [stateA1, stateB1, stateGainSink];

    const flowQuantities = [
        // A0 Flows
        { fromStateId: stateA0.id, toStateId: stateB1.container.id, qty: 5000000n }, // 500 to B
        { fromStateId: stateA0.id, toStateId: stateGainSink.container.id, qty: -10000n }, // -1 to Gain (Pre-Gain)
        // Remainder (501) goes to A1 automatically

        // B0 Flows
        { fromStateId: stateB0.id, toStateId: stateB1.container.id, qty: 10000000n }, // 1000 to B (All of it)
        
        // Loss Flows
        { fromStateId: stateLossSource.id, toStateId: stateB1.container.id, qty: lossQty } // -2 to B (Post-Loss)
    ];

    console.log("  Executing Complex Transfer...");
    OperationBuilder.createFlows({ fromContainers: allSources, flowQuantities }, allDests);
    OperationBuilder.assignFlowCompositions(allSources, allDests);
    OperationBuilder.assignOutputCompositions(allDests);

    // 4. Verify Results
    
    // Verify A1
    console.log(`  A1 State (Expected 501 gal): Qty=${stateA1.quantifiedComposition.qty}, Real=$${stateA1.quantifiedComposition.attributes.realDollars}`);

    // Verify B1
    console.log(`  B1 State (Expected 1498 gal): Qty=${stateB1.quantifiedComposition.qty}, Real=$${stateB1.quantifiedComposition.attributes.realDollars}`);

    const b1Qty = stateB1.quantifiedComposition.qty;
    const b1Real = stateB1.quantifiedComposition.attributes.realDollars as bigint;

    if (b1Qty < 14980000n - 5n || b1Qty > 14980000n + 5n) throw new Error(`B1 Qty mismatch. Got ${b1Qty}`);
    
    // 2500 - (2 * 2500 / 1500) = 2500 - 3.3333 = 2496.6666
    // 25000000 - 33333 = 24966667
    // Adjusted for Pre-Gain dilution: ~24961674
    if (b1Real < 24960000n || b1Real > 24970000n) throw new Error(`B1 Real $ mismatch. Got ${b1Real}`);

    console.log("  ✅ Complex Transfer Logic Verified.");
});
