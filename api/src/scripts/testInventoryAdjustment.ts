import { OperationBuilder } from "../core/OperationBuilder";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { QuantifiedComposition } from "../domain/nodes/QuantifiedComposition";
import { ContainerState } from "../domain/nodes/ContainerState";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Inventory Adjustment Test (Negative Flow)", async (session, helper) => {
    // 1. Setup: Tank A (1000 gal) and Gain Node
    const tankA = await helper.createContainer("tankA", "Tank A", "tank", 20000000);
    const gainNode = await helper.createContainer("gainNode", "Gain Node", "gain");

    const stateRepo = new ContainerStateRepo(session);

    // Initial State A0: 1000 gal, $1000 Real, $1000 Nominal
    const a0Comp: QuantifiedComposition = {
        qty: 10000000n, // 1000 gal
        unit: "gal",
        attributes: {
        varietal: { "CAB": 10000000n },
        realDollars: 10000000n,    // $1000
        nominalDollars: 10000000n  // $1000
        }
    };
    const stateA0: ContainerState = {
        id: crypto.randomUUID(),
        tenantId: "winery1",
        createdAt: new Date(),
        container: tankA,
        quantifiedComposition: a0Comp,
        timestamp: new Date(),
        flowsTo: [],
        flowsFrom: []
    };
    await stateRepo.create(stateA0);

    console.log("  Initial State A0:");
    console.log(`    Qty: ${stateA0.quantifiedComposition.qty}`);
    console.log(`    Real $: ${stateA0.quantifiedComposition.attributes.realDollars}`);
    console.log(`    Nominal $: ${stateA0.quantifiedComposition.attributes.nominalDollars}`);

    // 2. Operation: Inventory Adjustment (Gain 1 gal)
    // Modeled as:
    // A0 -> A1 (1001 gal)
    // A0 -> Gain (-1 gal)
    // Total Out from A0 = 1000 gal.

    const outputStates = OperationBuilder.createOutputStates({
        tenantId: "winery1",
        createdAt: new Date(),
        fromContainers: [stateA0]
    });
    
    const stateA1 = outputStates[0]; // The new state for Tank A
    
    // Create a transient state for Gain Node
    const stateGain: ContainerState = {
        id: crypto.randomUUID(),
        tenantId: "winery1",
        createdAt: new Date(),
        container: gainNode,
        quantifiedComposition: { qty: 0n, unit: "gal", attributes: {} },
        timestamp: new Date(),
        flowsTo: [],
        flowsFrom: []
    };

    const toContainers = [stateA1, stateGain];

    // Define Flows
    // A0 -> A1: 1001 gal
    // A0 -> Gain: -1 gal
    const flowQuantities = [
        { fromStateId: stateA0.id, toStateId: stateA1.container.id, qty: 10010000n },
        { fromStateId: stateA0.id, toStateId: stateGain.container.id, qty: -10000n }
    ];

    console.log("  Executing Adjustment...");
    
    OperationBuilder.createFlows({ fromContainers: [stateA0], flowQuantities }, toContainers);
    OperationBuilder.assignFlowCompositions([stateA0], toContainers);
    OperationBuilder.assignOutputCompositions(toContainers);

    // 3. Verify A1
    console.log("  A1 State (After Adjustment):");
    console.log(`    Qty: ${stateA1.quantifiedComposition.qty}`);
    console.log(`    Real $: ${stateA1.quantifiedComposition.attributes.realDollars}`);
    console.log(`    Nominal $: ${stateA1.quantifiedComposition.attributes.nominalDollars}`);

    // Expectations:
    // Qty: 1001
    // Real $: 1000 (Conserved)
    // Nominal $: 1001 (Increased)

    const qty = stateA1.quantifiedComposition.qty;
    const real = stateA1.quantifiedComposition.attributes.realDollars as bigint;
    const nominal = stateA1.quantifiedComposition.attributes.nominalDollars as bigint;

    if (qty !== 10010000n) throw new Error("Qty mismatch");
    if (real !== 10000000n) throw new Error(`Real $ mismatch. Expected 10000000n, got ${real}`);
    if (nominal !== 10010000n) throw new Error(`Nominal $ mismatch. Expected 10010000n, got ${nominal}`);

    console.log("  ✅ Inventory Adjustment Logic Verified.");
});
