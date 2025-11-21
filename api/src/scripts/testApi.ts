import { app } from "../app";
import { TestHelper } from "../test-utils/TestHelper";
import { getDriver } from "../db/client";
import http from "http";

async function runApiTests() {
    console.log("🚀 Starting API Tests...");

    // 1. Start Server
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(3001, resolve));
    const baseUrl = "http://localhost:3001";
    console.log("  📡 Test server running on port 3001");

    const driver = getDriver();
    const session = driver.session();
    const helper = new TestHelper(session);

    try {
        // 2. Seed Data
        await helper.cleanDb();
        const tankA = await helper.createContainer("tankA", "Tank A", "tank");
        await helper.createState(tankA, 1000n, { "CAB": 1000n });
        console.log("  🌱 Seeded Tank A");

        // 3. Test GET /api/containers
        console.log("  🧪 Testing GET /api/containers...");
        const resContainers = await fetch(`${baseUrl}/api/containers`);
        if (!resContainers.ok) throw new Error(`Failed: ${resContainers.statusText}`);
        const containers: any = await resContainers.json();
        console.log(`     Got ${containers.length} containers`);
        
        if (containers.length !== 1) throw new Error("Expected 1 container");
        if (containers[0].id !== "tankA") throw new Error("Expected tankA");
        if (containers[0].capacityHUnits !== "10000") throw new Error(`Expected capacity 10000, got ${containers[0].capacityHUnits}`);

        // 4. Test GET /api/containers/:id
        console.log("  🧪 Testing GET /api/containers/tankA...");
        const resTank = await fetch(`${baseUrl}/api/containers/tankA`);
        if (!resTank.ok) throw new Error(`Failed: ${resTank.statusText}`);
        const tank: any = await resTank.json();
        if (tank.id !== "tankA") throw new Error("Expected tankA details");

        // 5. Test GET /api/operations (Empty)
        console.log("  🧪 Testing GET /api/operations...");
        const resOps = await fetch(`${baseUrl}/api/operations`);
        if (!resOps.ok) throw new Error(`Failed: ${resOps.statusText}`);
        const ops: any = await resOps.json();
        if (ops.length !== 0) throw new Error("Expected 0 operations");

        console.log("\n✅ API Tests Passed");

    } catch (e) {
        console.error("\n❌ API Tests Failed", e);
        process.exit(1);
    } finally {
        server.close();
        await session.close();
        await driver.close();
    }
}

runApiTests();
