import { TestHelper } from "../test-utils/TestHelper";
import { WineryOperationService } from "../core/WineryOperationService";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { getDriver } from "../db/client";
import { perf } from "../util/PerformanceMonitor";

async function runParallelScalingTest(numOperations: number, concurrency: number) {
    const driver = getDriver();
    const session = driver.session();
    const helper = new TestHelper(session);

    console.log(`\n🚀 Starting Parallel Scaling Test: ${numOperations} ops, concurrency ${concurrency}`);

    try {
        // 1. Setup: Clean & Seed
        console.log("  🧹 Cleaning and Seeding...");
        await helper.cleanDb();

        // Create 100 tanks to reduce contention
        const tanks: Container[] = [];
        for (let i = 0; i < 100; i++) {
            tanks.push(await helper.createContainer(`tank-${i}`, `Tank ${i}`, "tank", 1000000n));
        }

        // Fill the first 50 tanks
        for (let i = 0; i < 50; i++) {
            await helper.createState(tanks[i], 10000000n, { "CAB": 10000000n }, 100000000n, 100000000n);
        }

        console.log("  ✅ Setup complete. Starting operations...");

        const startTime = Date.now();
        let completed = 0;
        let failures = 0;
        let skipped = 0;

        // Worker function
        const runWorker = async (workerId: number, opsToRun: number) => {
            for (let i = 0; i < opsToRun; i++) {
                const workerSession = driver.session();
                const workerHelper = new TestHelper(workerSession);
                try {
                    // Retry logic to find a valid source
                    let sourceTank: Container | null = null;
                    let sourceState: ContainerState | null = null;
                    let attempts = 0;

                    while (attempts < 5) {
                        const idx = Math.floor(Math.random() * 100);
                        const candidate = tanks[idx];
                        // Note: getHeadState is a read, so it's fast.
                        const state = await workerHelper.getHeadState(candidate.id);
                        
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
                    let destIndex = Math.floor(Math.random() * 100);
                    while (tanks[destIndex].id === sourceTank.id) {
                        destIndex = Math.floor(Math.random() * 100);
                    }
                    const destTank = tanks[destIndex];
                    const destState = await workerHelper.getHeadState(destTank.id); 

                    // Transfer Amount
                    const transferQty = 100n;

                    // Build Operation
                    const runId = Date.now();
                    const opId = `perf-op-${runId}-${workerId}-${i}`;
                    const op = await WineryOperationService.buildWineryOperation({
                        id: opId,
                        type: "transfer",
                        description: `Perf Test Op ${workerId}-${i} (Run ${runId})`,
                        tenantId: "perf-test",
                        createdAt: new Date(),
                        fromContainers: destState ? [sourceState, destState] : [sourceState],
                        flowQuantities: [
                            { fromStateId: sourceState.id, toStateId: destTank.id, qty: transferQty }
                        ]
                    });

                    await WineryOperationService.validateAndCommitOperation(op);
                    completed++;

                    if (completed % 100 === 0) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const rate = completed / elapsed;
                        process.stdout.write(`\r  ⏳ Progress: ${completed}/${numOperations} (${rate.toFixed(2)} ops/sec)`);
                    }

                } catch (err: any) {
                    // Optimistic locking failures are expected in high concurrency
                    if (err.message && (err.message.includes("LockClient") || err.message.includes("/ by zero"))) {
                        // Ignore lock failures and our custom "division by zero" validation error
                    } else {
                        if (failures < 5) {
                            console.error(`Failure: ${err.message}`);
                        }
                    }
                    failures++;
                } finally {
                    await workerSession.close();
                }
            }
        };

        // Launch workers
        const opsPerWorker = Math.ceil(numOperations / concurrency);
        const workers = [];
        for (let i = 0; i < concurrency; i++) {
            workers.push(runWorker(i, opsPerWorker));
        }

        await Promise.all(workers);

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\n\n🏁 Finished!`);
        console.log(`  Total Time: ${totalTime.toFixed(2)}s`);
        console.log(`  Throughput: ${(completed / totalTime).toFixed(2)} ops/sec`);
        console.log(`  Success: ${completed}`);
        console.log(`  Skipped: ${skipped}`);
        console.log(`  Failures: ${failures}`);

        perf.report();

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

const args = process.argv.slice(2);
const count = args.length > 0 ? parseInt(args[0]) : 500;
const concurrency = args.length > 1 ? parseInt(args[1]) : 10;

runParallelScalingTest(count, concurrency);
