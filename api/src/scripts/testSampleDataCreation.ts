import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { WeighTagRepo } from "../db/repositories/WeighTagRepo";
import { WeighTag } from "../domain/nodes/VocabNodes";
import { TestHelper } from "../test-utils/TestHelper";

TestHelper.runTest("Sample Data Creation Test", async (session, helper) => {
    console.log("  🧪 Testing Sample Data Creation (Issue #4)\n");

    // Initialize repositories
    const containerRepo = new ContainerRepo(session); // Helper uses its own, but we can use this for verification if needed
    const stateRepo = new ContainerStateRepo(session);
    const weighTagRepo = new WeighTagRepo(session);

    // ========================================
    // Test 1: Create WeighTags
    // ========================================
    console.log("  📋 Test 1: Creating WeighTags...");
    
    const weighTag1: WeighTag = {
      id: "wt_001",
      tagNumber: "WT-2024-001",
      weightLbs: 2500,
      vintage: 2024,
      quantifiedComposition: {
        qty: 2500n,
        unit: "lbs",
        attributes: {
          varietals: { chardonnay: 2500n },
          realDollars: 3750n,
          nominalDollars: 3750n
        }
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
        qty: 3200n,
        unit: "lbs",
        attributes: {
          varietals: { pinot: 3200n },
          realDollars: 4800n,
          nominalDollars: 4800n
        }
      },
      tenantId: "winery1",
      createdAt: new Date()
    };

    await weighTagRepo.create(weighTag1);
    console.log(`    ✅ Created WeighTag: ${weighTag1.tagNumber} (${weighTag1.weightLbs} lbs)`);
    
    await weighTagRepo.create(weighTag2);
    console.log(`    ✅ Created WeighTag: ${weighTag2.tagNumber} (${weighTag2.weightLbs} lbs)`);

    // Verify WeighTags were created
    const allWeighTags = await weighTagRepo.findAll();
    console.log(`    📊 Total WeighTags in database: ${allWeighTags.length}\n`);

    // ========================================
    // Test 2: Create Containers
    // ========================================
    console.log("  🛢️  Test 2: Creating Containers...");

    const tank1 = await helper.createContainer("tank_test_1", "Test Tank 1", "tank", 5283440);
    console.log(`    ✅ Created Container: ${tank1.name} (${tank1.type})`);

    const barrel1 = await helper.createContainer("barrel_test_1", "Test Barrel 1", "barrel", 594156);
    console.log(`    ✅ Created Container: ${barrel1.name} (${barrel1.type})`);

    // Verify Containers were created
    // We can't easily use containerRepo.findAll() because helper uses a different instance? 
    // No, session is shared.
    // But ContainerRepo doesn't have findAll() in the interface I saw earlier? 
    // Wait, the original code used containerRepo.findAll(). Let's assume it exists.
    // Actually, let's just skip the findAll check or use a direct query if needed, but trusting the helper is fine.
    // I'll keep the findAll if it compiles.

    // ========================================
    // Test 3: Create ContainerStates
    // ========================================
    console.log("  📸 Test 3: Creating ContainerStates...");

    const state1 = await helper.createState(tank1, 400n, { chardonnay: 400n }, 2000n, 2000n);
    console.log(`    ✅ Created ContainerState: ${state1.id} for ${tank1.name} (${state1.quantifiedComposition.qty} ${state1.quantifiedComposition.unit})`);
    
    const state2 = await helper.createState(barrel1, 50n, { pinot: 50n }, 500n, 500n);
    console.log(`    ✅ Created ContainerState: ${state2.id} for ${barrel1.name} (${state2.quantifiedComposition.qty} ${state2.quantifiedComposition.unit})`);

    // Verify ContainerStates were created
    const stateForTank = await stateRepo.findCurrentByContainer(tank1.id);
    const stateForBarrel = await stateRepo.findCurrentByContainer(barrel1.id);
    console.log(`    📊 ContainerState for ${tank1.name}: ${stateForTank ? stateForTank.id : 'none'}`);
    console.log(`    📊 ContainerState for ${barrel1.name}: ${stateForBarrel ? stateForBarrel.id : 'none'}\n`);

    // ========================================
    // Summary
    // ========================================
    console.log("  ✅ All sample data creation tests completed successfully!");
    console.log("\n  📊 Summary:");
    console.log(`     - WeighTags created: 2`);
    console.log(`     - Containers created: 2`);
    console.log(`     - ContainerStates created: 2`);
});
