// src/scripts/testSampleDataCreation.ts
// Intent: Test script to demonstrate creating WeighTags, Containers, and ContainerStates
// Reasoning: Addresses issue #4 - API methods for generating sample starting data

import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { WeighTagRepo } from "../db/repositories/WeighTagRepo";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { WeighTag } from "../domain/nodes/VocabNodes";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("🧪 Testing Sample Data Creation (Issue #4)\n");

    // Initialize repositories
    const containerRepo = new ContainerRepo(session);
    const stateRepo = new ContainerStateRepo(session);
    const weighTagRepo = new WeighTagRepo(session);

    // ========================================
    // Test 1: Create WeighTags
    // ========================================
    console.log("📋 Test 1: Creating WeighTags...");
    
    const weighTag1: WeighTag = {
      id: "wt_001",
      tagNumber: "WT-2024-001",
      weightLbs: 2500,
      vintage: 2024,
      quantifiedComposition: {
        qty: 2500,
        unit: "lbs",
        varietals: { chardonnay: 2500 },
        realDollars: 3750,
        nominalDollars: 3750
      },
      tenantId: "winery1",
      createdAt: new Date()
    };

    const weighTag2: WeighTag = {
      id: "wt_002",
      tagNumber: "WT-2024-002",
      weightLbs: 3200,
      vintage: 2024,
      quantifiedComposition: {
        qty: 3200,
        unit: "lbs",
        varietals: { pinot: 3200 },
        realDollars: 4800,
        nominalDollars: 4800
      },
      tenantId: "winery1",
      createdAt: new Date()
    };

    await weighTagRepo.create(weighTag1);
    console.log(`  ✅ Created WeighTag: ${weighTag1.tagNumber} (${weighTag1.weightLbs} lbs)`);
    
    await weighTagRepo.create(weighTag2);
    console.log(`  ✅ Created WeighTag: ${weighTag2.tagNumber} (${weighTag2.weightLbs} lbs)`);

    // Verify WeighTags were created
    const allWeighTags = await weighTagRepo.findAll();
    console.log(`  📊 Total WeighTags in database: ${allWeighTags.length}\n`);

    // ========================================
    // Test 2: Create Containers
    // ========================================
    console.log("🛢️  Test 2: Creating Containers...");

    const tank1: Container = {
      id: "tank_test_1",
      name: "Test Tank 1",
      type: "tank",
      capacityHUnits: 5283440, // ~500 gallons
      tenantId: "winery1",
      createdAt: new Date()
    };

    const barrel1: Container = {
      id: "barrel_test_1",
      name: "Test Barrel 1",
      type: "barrel",
      capacityHUnits: 594156, // ~56 gallons
      tenantId: "winery1",
      createdAt: new Date()
    };

    await containerRepo.create(tank1);
    console.log(`  ✅ Created Container: ${tank1.name} (${tank1.type})`);
    
    await containerRepo.create(barrel1);
    console.log(`  ✅ Created Container: ${barrel1.name} (${barrel1.type})`);

    // Verify Containers were created
    const allContainers = await containerRepo.findAll();
    console.log(`  📊 Total Containers in database: ${allContainers.length}\n`);

    // ========================================
    // Test 3: Create ContainerStates
    // ========================================
    console.log("📸 Test 3: Creating ContainerStates...");

    const state1: ContainerState = {
      id: "state_test_tank_1",
      container: tank1,
      quantifiedComposition: {
        qty: 400,
        unit: "gal",
        varietals: { chardonnay: 400 },
        realDollars: 2000,
        nominalDollars: 2000
      },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date()
    };

    const state2: ContainerState = {
      id: "state_test_barrel_1",
      container: barrel1,
      quantifiedComposition: {
        qty: 50,
        unit: "gal",
        varietals: { pinot: 50 },
        realDollars: 500,
        nominalDollars: 500
      },
      timestamp: new Date(),
      tenantId: "winery1",
      createdAt: new Date()
    };

    await stateRepo.create(state1);
    console.log(`  ✅ Created ContainerState: ${state1.id} for ${tank1.name} (${state1.quantifiedComposition.qty} ${state1.quantifiedComposition.unit})`);
    
    await stateRepo.create(state2);
    console.log(`  ✅ Created ContainerState: ${state2.id} for ${barrel1.name} (${state2.quantifiedComposition.qty} ${state2.quantifiedComposition.unit})`);

    // Verify ContainerStates were created
    const statesForTank = await stateRepo.findCurrentByContainer(tank1.id);
    const statesForBarrel = await stateRepo.findCurrentByContainer(barrel1.id);
    console.log(`  📊 ContainerStates for ${tank1.name}: ${statesForTank.length}`);
    console.log(`  📊 ContainerStates for ${barrel1.name}: ${statesForBarrel.length}\n`);

    // ========================================
    // Summary
    // ========================================
    console.log("✅ All sample data creation tests completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - WeighTags created: 2`);
    console.log(`   - Containers created: 2`);
    console.log(`   - ContainerStates created: 2`);
    console.log("\n💡 This demonstrates the ability to generate starting sample data for:");
    console.log("   1. WeighTags (grape reception tracking)");
    console.log("   2. Containers (tanks, barrels, etc.)");
    console.log("   3. ContainerStates (container snapshots with quantities and composition)");

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
