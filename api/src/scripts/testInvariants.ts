// Intent: Test invariants enforcement on various operation scenarios
// Reasoning: Validates that invariants correctly detect violations and allow valid operations

import { Invariants } from "../core/Invariants";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { ContainerState } from "../domain/nodes/ContainerState";
import { FlowToRelationship } from "../domain/relationships/Flow_to";
import { TestHelper } from "../test-utils/TestHelper";

// Helper to create a mock state
function makeState(id: string, qty: bigint, real: bigint, nominal: bigint): ContainerState {
    return {
        id,
        tenantId: "test",
        createdAt: new Date(),
        timestamp: new Date(),
        container: { id: "c_" + id, name: "C " + id, type: "tank", tenantId: "test", createdAt: new Date() },
        quantifiedComposition: {
            qty,
            unit: "gal",
            attributes: { realDollars: real, nominalDollars: nominal }
        },
        flowsTo: [],
        flowsFrom: []
    };
}

// Helper to create a flow
function makeFlow(from: ContainerState, to: ContainerState, qty: bigint, real: bigint, nominal: bigint): FlowToRelationship {
    return {
        from: { id: from.id },
        to: { id: to.id },
        properties: {
            qty,
            unit: "gal",
            attributes: { realDollars: real, nominalDollars: nominal }
        }
    };
}

TestHelper.runTest("Invariants Unit Tests", async () => {
  console.log("=== Testing Invariants ===\n");

  // Setup States
  const s1 = makeState("s1", 1000n, 1000n, 1000n);
  const s2 = makeState("s2", 1000n, 1000n, 1000n);
  const out1 = makeState("out1", 1000n, 1000n, 1000n);
  const out2 = makeState("out2", 1000n, 1000n, 1000n);

  // Test 1: Valid Transfer
  // s1 -> out1 (500)
  // s1 -> out2 (500)
  // s2 -> out1 (500)
  // s2 -> out2 (500)
  // Total Out from s1: 1000. Total In to out1: 1000.
  
  const flows1 = [
      makeFlow(s1, out1, 500n, 500n, 500n),
      makeFlow(s1, out2, 500n, 500n, 500n),
      makeFlow(s2, out1, 500n, 500n, 500n),
      makeFlow(s2, out2, 500n, 500n, 500n)
  ];

  const op1: WineryOperation = {
      id: "op1",
      type: "transfer",
      tenantId: "test",
      createdAt: new Date(),
      inputStates: [s1, s2],
      outputStates: [out1, out2],
      flows: flows1
  };

  let result = Invariants.assertQuantityConservation(op1);
  console.log(`Test 1 (Qty): ${result.ok ? "PASS" : "FAIL " + result.message}`);
  if (!result.ok) throw new Error(`Test 1 failed: ${result.message}`);
  
  result = Invariants.assertCompositionConservation(op1);
  console.log(`Test 1 (Comp): ${result.ok ? "PASS" : "FAIL " + result.message}`);
  if (!result.ok) throw new Error(`Test 1 failed: ${result.message}`);

  // Test 2: Invalid Quantity (Leak)
  // s1 -> out1 (400) -- Missing 600 from s1
  const flows2 = [
      makeFlow(s1, out1, 400n, 400n, 400n)
  ];
  const op2: WineryOperation = {
      ...op1,
      id: "op2",
      inputStates: [s1], // Only s1 involved
      outputStates: [out1], // Only out1 involved
      flows: flows2
  };
  // Note: out1 expects 1000 (from makeState), but getting 400.
  
  result = Invariants.assertQuantityConservation(op2);
  console.log(`Test 2 (Invalid Qty): ${!result.ok ? "PASS" : "FAIL - Should have failed"}`);
  if (result.ok) throw new Error("Test 2 failed: Should have detected invalid quantity");

  // Test 3: Invalid Composition (Dollars don't match)
  // s1 -> out1 (1000 gal, but 0 dollars)
  const flows3 = [
      makeFlow(s1, out1, 1000n, 0n, 0n)
  ];
  const op3: WineryOperation = {
      ...op1,
      id: "op3",
      inputStates: [s1],
      outputStates: [out1],
      flows: flows3
  };
  
  result = Invariants.assertCompositionConservation(op3);
  console.log(`Test 3 (Invalid Comp): ${!result.ok ? "PASS" : "FAIL - Should have failed"}`);
  if (result.ok) throw new Error("Test 3 failed: Should have detected invalid composition");

  console.log("=== Invariant Tests Complete ===");
});

