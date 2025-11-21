import { getDriver } from "../db/client";
import { LineageRepo } from "../db/repositories/LineageRepo";
import { perf } from "../util/PerformanceMonitor";

async function runLineageTest() {
    const driver = getDriver();
    const session = driver.session();

    try {
        // Use hardcoded target from user request
        const targetId = "552ba951-1eb4-4420-a9ae-da31149aefb7";
        console.log(`✅ Using target state ${targetId}`);
        const maxLen = 20; // Assume sufficient depth for testing

        // Warmup
        await LineageRepo.getUpstreamLineage(targetId, 1);

        // Test various depths
        const depths = [1, 3, 5, 10, 20];
        
        console.log("\n🚀 Starting Lineage Performance Test");
        
        for (const depth of depths) {
            if (depth > maxLen + 5) break; // Don't test beyond what we have

            const graph = await LineageRepo.getUpstreamLineage(targetId, depth);
            console.log(`  Depth ${depth}: Found ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
        }

        perf.report();

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

runLineageTest();
