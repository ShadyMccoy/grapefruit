import { TestHelper } from "../test-utils/TestHelper";
import { WineryOperationService } from "../core/WineryOperationService";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { getDriver } from "../db/client";

async function runScalingTest(numOperations: number) {
    const driver = getDriver();
    const session = driver.session();
    const helper = new TestHelper(session);

    console.log(`\n🚀 Starting Scaling Test: ${numOperations} operations`);

    try {
        // 1. Setup: Clean & Seed
        console.log("  🧹 Cleaning and Seeding...");
        await helper.cleanDb();

        // Create 50 tanks
        const tanks: Container[] = [];
        for (let i = 0; i < 50; i++) {
            tanks.push(await helper.createContainer(`tank-${i}`, `Tank ${i}`, "tank", 100000n));
        }

        // Fill the first 25 tanks with A LOT of wine
        const states: ContainerState[] = [];
        for (let i = 0; i < 25; i++) {
            states.push(await helper.createState(tanks[i], 10000000n, { "CAB": 10000000n }, 100000000n, 100000000n));
        }

        console.log("  ✅ Setup complete. Starting operations...");

        const startTime = Date.now();
        let completed = 0;
        let failures = 0;
        let skipped = 0;

        for (let i = 0; i < numOperations; i++) {
            try {
                // Retry logic to find a valid source
                let sourceTank: Container | null = null;
                let sourceState: ContainerState | null = null;
                let attempts = 0;

                while (attempts < 5) {
                    const idx = Math.floor(Math.random() * 50);
                    const candidate = tanks[idx];
                    const state = await helper.getHeadState(candidate.id);
                    
                    if (state && state.quantifiedComposition.qty > 1000n) {
                        sourceTank = candidate;
                        sourceState = state;
                        break;
                    }
                    attempts++;
                }

                if (!sourceTank || !sourceState) {
                    skipped++;
                    continue;
                }

                // Random destination
                let destIndex = Math.floor(Math.random() * 50);
                while (tanks[destIndex].id === sourceTank.id) {
                    destIndex = Math.floor(Math.random() * 50);
                }
                const destTank = tanks[destIndex];
                const destState = await helper.getHeadState(destTank.id); 

                // Transfer Amount
                const transferQty = 100n;

                // Build Operation
                const op = await WineryOperationService.buildWineryOperation({
                    id: `perf-op-${i}`,
                    type: "transfer",
                    description: `Perf Test Op ${i}`,
                    tenantId: "perf-test",
                    createdAt: new Date(),
                    fromContainers: destState ? [sourceState, destState] : [sourceState],
                    flowQuantities: [
                        { fromStateId: sourceState.id, toStateId: destTank.id, qty: transferQty }
                    ]
                });

                await WineryOperationService.validateAndCommitOperation(op);
                completed++;

                if (completed % 50 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = completed / elapsed;
                    process.stdout.write(`\r  ⏳ Progress: ${completed}/${numOperations} (${rate.toFixed(2)} ops/sec)`);
                }

            } catch (err) {
                failures++;
                // console.error(`Op ${i} failed:`, err);
            }
        }

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\n\n🏁 Finished!`);
        console.log(`  Total Time: ${totalTime.toFixed(2)}s`);
        console.log(`  Throughput: ${(completed / totalTime).toFixed(2)} ops/sec`);
        console.log(`  Success: ${completed}`);
        console.log(`  Skipped: ${skipped}`);
        console.log(`  Failures: ${failures}`);

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

// Allow running with argument: npx tsx src/scripts/testScaling.ts 500
const args = process.argv.slice(2);
const count = args.length > 0 ? parseInt(args[0]) : 100;

runScalingTest(count);
