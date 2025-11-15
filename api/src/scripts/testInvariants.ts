// Intent: Test invariants enforcement on various operation scenarios
// Reasoning: Validates that invariants correctly detect violations and allow valid operations

import { Invariants } from "../core/Invariants";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { getDriver } from "../db/client";

async function testInvariants() {
  console.log("=== Testing Invariants ===\n");

  // Test 1: Valid transfer operation (should pass)
  console.log("Test 1: Valid transfer operation");
  const validOp: WineryOperation = {
    id: "test_valid_transfer",
    type: "transfer",
    tenantId: "winery1",
    createdAt: new Date(),
    inputStateIds: ["state1", "state2"],
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_out_1",
        qty: 950,
        unit: "gal",
        composition: { realDollars: 4750, nominalDollars: 4800 }
      },
      {
        containerId: "tankB",
        stateId: "state_out_2",
        qty: 850,
        unit: "gal",
        composition: { realDollars: 4250, nominalDollars: 4200 }
      }
    ],
    flows: [
      // Valid delta flows: net zero for each input
      { from: 0, to: 1, qty: 50, unit: "gal", composition: { realDollars: 250, nominalDollars: 240 } },
      { from: 0, to: 0, qty: -50, unit: "gal", composition: { realDollars: -250, nominalDollars: -240 } },
      { from: 1, to: 1, qty: 0, unit: "gal", composition: { realDollars: 0, nominalDollars: 0 } }
    ]
  };

  let result = Invariants.assertQuantityConservation(validOp);
  console.log(`  Quantity conservation: ${result.ok ? "✓ PASS" : "✗ FAIL - " + result.message}`);

  result = Invariants.assertCompositionConservation(validOp);
  console.log(`  Composition conservation: ${result.ok ? "✓ PASS" : "✗ FAIL - " + result.message}`);

  result = Invariants.assertNominalDollarConservation(validOp);
  console.log(`  Nominal dollar conservation: ${result.ok ? "✓ PASS" : "✗ FAIL - " + result.message}`);

  result = Invariants.assertValidFlowIndices(validOp);
  console.log(`  Valid flow indices: ${result.ok ? "✓ PASS" : "✗ FAIL - " + result.message}\n`);

  // Test 2: Invalid quantity conservation (net flows don't sum to zero)
  console.log("Test 2: Invalid quantity conservation");
  const invalidQtyOp: WineryOperation = {
    id: "test_invalid_qty",
    type: "transfer",
    tenantId: "winery1",
    createdAt: new Date(),
    inputStateIds: ["state1", "state2"],
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_out_1",
        qty: 950,
        unit: "gal",
        composition: { realDollars: 4750, nominalDollars: 4800 }
      }
    ],
    flows: [
      // Invalid: net flow from input 0 is not zero (50 instead of 0)
      { from: 0, to: 0, qty: 50, unit: "gal", composition: { realDollars: 250, nominalDollars: 240 } }
    ]
  };

  result = Invariants.assertQuantityConservation(invalidQtyOp);
  console.log(`  Should detect violation: ${!result.ok ? "✓ PASS - " + result.code : "✗ FAIL - Should have failed"}\n`);

  // Test 3: Invalid composition conservation (composition doesn't net to zero)
  console.log("Test 3: Invalid composition conservation");
  const invalidCompOp: WineryOperation = {
    id: "test_invalid_comp",
    type: "transfer",
    tenantId: "winery1",
    createdAt: new Date(),
    inputStateIds: ["state1"],
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_out_1",
        qty: 1000,
        unit: "gal",
        composition: { realDollars: 5000, nominalDollars: 5000 }
      }
    ],
    flows: [
      // Invalid: net composition doesn't sum to zero
      { from: 0, to: 0, qty: 50, unit: "gal", composition: { realDollars: 250, nominalDollars: 240 } },
      { from: 0, to: 0, qty: -50, unit: "gal", composition: { realDollars: -200, nominalDollars: -240 } } // Wrong real dollars
    ]
  };

  result = Invariants.assertCompositionConservation(invalidCompOp);
  console.log(`  Should detect violation: ${!result.ok ? "✓ PASS - " + result.code : "✗ FAIL - Should have failed"}\n`);

  // Test 4: Invalid flow indices
  console.log("Test 4: Invalid flow indices");
  const invalidIndexOp: WineryOperation = {
    id: "test_invalid_index",
    type: "transfer",
    tenantId: "winery1",
    createdAt: new Date(),
    inputStateIds: ["state1"],
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_out_1",
        qty: 1000,
        unit: "gal",
        composition: { realDollars: 5000, nominalDollars: 5000 }
      }
    ],
    flows: [
      // Invalid: from index 5 doesn't exist (only 0 exists)
      { from: 5, to: 0, qty: 0, unit: "gal", composition: {} }
    ]
  };

  result = Invariants.assertValidFlowIndices(invalidIndexOp);
  console.log(`  Should detect violation: ${!result.ok ? "✓ PASS - " + result.code : "✗ FAIL - Should have failed"}\n`);

  // Test 5: Nominal dollar conservation violation
  console.log("Test 5: Nominal dollar conservation");
  const invalidNominalOp: WineryOperation = {
    id: "test_invalid_nominal",
    type: "transfer",
    tenantId: "winery1",
    createdAt: new Date(),
    inputStateIds: ["state1"],
    outputSpecs: [
      {
        containerId: "tankA",
        stateId: "state_out_1",
        qty: 1000,
        unit: "gal",
        composition: { realDollars: 5000, nominalDollars: 5000 }
      }
    ],
    flows: [
      // Invalid: nominal dollars don't net to zero (100 instead of 0)
      { from: 0, to: 0, qty: 0, unit: "gal", composition: { realDollars: 0, nominalDollars: 100 } }
    ]
  };

  result = Invariants.assertNominalDollarConservation(invalidNominalOp);
  console.log(`  Should detect violation: ${!result.ok ? "✓ PASS - " + result.code : "✗ FAIL - Should have failed"}\n`);

  console.log("=== Invariant Tests Complete ===");
  
  // Clean up
  const driver = getDriver();
  await driver.close();
}

testInvariants().catch(console.error);
