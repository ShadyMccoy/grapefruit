// src/scripts/testCypher.ts
import { getDriver } from "../db/client";

async function testCypher(description: string, cypher: string, params: any = {}) {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`Cypher: ${cypher.trim().split('\n')[0]}...`);

    const result = await session.run(cypher, params);

    console.log(`✅ Success: ${result.records.length} records returned`);

    if (result.records.length > 0 && result.records[0].keys.length > 0) {
      const firstRecord = result.records[0];
      firstRecord.keys.forEach(key => {
        console.log(`   ${String(key)}: ${JSON.stringify(firstRecord.get(key))}`);
      });
    }

    return result;
  } catch (error) {
    console.log(`❌ Failed: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    // Test 1: Basic operation creation
    await testCypher(
      "Create basic operation",
      `
      CREATE (op:WineryOperation {
        id: $id,
        type: $type,
        description: $description,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      RETURN id(op) AS opId
      `,
      {
        id: "test_op_1",
        type: "blend",
        description: "Test operation",
        tenantId: "winery1",
        createdAt: new Date().toISOString()
      }
    );

    // Test 2: Match existing states
    await testCypher(
      "Match input states",
      `
      MATCH (s:ContainerState)
      WHERE s.id IN $inputStateIds
      RETURN count(s) AS stateCount, collect(s.id) AS stateIds
      `,
      {
        inputStateIds: ["state_tankA_initial", "state_tankB_initial"]
      }
    );

    // Test 4: Create flow relationship
    await testCypher(
      "Create flow relationship",
      `
      MATCH (from:ContainerState {id: $fromId})
      MATCH (to:ContainerState {id: $toId})
      CREATE (from)-[:FLOW_TO {
        qty: $qty,
        unit: 'gal',
        composition: from.composition
      }]->(to)
      RETURN 'Flow created' AS result
      `,
      {
        fromId: "state_tankA_initial",
        toId: "test_output_state",
        qty: 1000
      }
    );

    // Test 5: Complete operation creation (simplified)
    await testCypher(
      "Complete operation creation",
      `
      CREATE (op:WineryOperation {
        id: $id,
        type: $type,
        description: $description,
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      WITH op
      UNWIND $inputStateIds AS inputId
      MATCH (inputState:ContainerState {id: inputId})
      CREATE (op)-[:WINERY_OP_INPUT]->(inputState)
      WITH op
      MATCH (outputContainer:Container {id: $outputContainerId})
      CREATE (outputState:ContainerState {
        id: $id + '_output',
        qty: $totalQty,
        unit: 'gal',
        composition: $outputComposition,
        timestamp: datetime(),
        tenantId: $tenantId,
        createdAt: datetime($createdAt)
      })
      CREATE (outputState)-[:STATE_OF]->(outputContainer)
      CREATE (op)-[:WINERY_OP_OUTPUT]->(outputState)
      RETURN id(op) AS opId
      `,
      {
        id: "test_complete_op",
        type: "blend",
        description: "Complete test operation",
        tenantId: "winery1",
        createdAt: new Date().toISOString(),
        inputStateIds: ["state_tankA_initial", "state_tankB_initial"],
        outputContainerId: "tankA",
        totalQty: 1800,
        outputComposition: JSON.stringify({ varietals: { chardonnay: 0.556, pinot: 0.444 } })
      }
    );

    console.log("\n🎉 All Cypher tests completed!");

  } catch (error) {
    console.error("Test suite failed:", error);
    process.exit(1);
  } finally {
    await getDriver().close();
  }
}

main();