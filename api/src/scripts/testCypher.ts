// src/scripts/testCypher.ts
import { TestHelper } from "../test-utils/TestHelper";
import { v4 as uuidv4 } from "uuid";

TestHelper.runTest("Cypher Query Test", async (session) => {
  const tankAId = "tankA";
  const tankBId = "tankB";
  const stateAId = uuidv4();
  const stateBId = uuidv4();

  // 1. Setup: Create two tanks and their initial states
  // We need to ensure they have 'composition' property as the query expects it
  // In our real app, it's 'quantifiedComposition' serialized, but this test uses raw Cypher
  // so we'll stick to what the query expects or update the query to match the schema.
  // The query uses `composition: tankBState.composition`.
  // Let's assume we want to test the logic with a simple string or JSON string for composition.
  
  await session.run(
    `
    CREATE (a:Container {id: $tankAId, name: 'Tank A'})
    CREATE (b:Container {id: $tankBId, name: 'Tank B'})
    CREATE (sa:ContainerState {
      id: $stateAId, 
      qty: 1000, 
      unit: 'gal',
      composition: '{"A": 100}',
      timestamp: datetime(),
      tenantId: 'winery1',
      createdAt: datetime()
    })
    CREATE (sb:ContainerState {
      id: $stateBId, 
      qty: 500, 
      unit: 'gal',
      composition: '{"B": 100}',
      timestamp: datetime(),
      tenantId: 'winery1',
      createdAt: datetime()
    })
    CREATE (sa)-[:STATE_OF]->(a)
    CREATE (sb)-[:STATE_OF]->(b)
    // Note: The query matches (s)-[:STATE_OF]->(c) AND checks for no outgoing flow
    // It doesn't explicitly check for CURRENT_STATE relationship in the MATCH clause shown in the original file,
    // but it does check WHERE NOT (s)-[:FLOW_TO]->()
    `,
    { tankAId, tankBId, stateAId, stateBId }
  );

  console.log("Setup complete.");

  const operationId = "transfer_test_1";

  // 2. Execute Transfer Logic (The original Cypher query)
  const result = await session.run(
    `
      // Create the transfer operation
      CREATE (op:WineryOperation {
        id: $operationId,
        type: 'transfer',
        description: 'Transfer 50 gallons from Tank B to Tank A',
        tenantId: 'winery1',
        createdAt: datetime()
      })

      // Match current states of both containers
      WITH op
      MATCH (tankA:Container {id: 'tankA'})
      MATCH (tankB:Container {id: 'tankB'})
      MATCH (tankAState:ContainerState)-[:STATE_OF]->(tankA)
      WHERE NOT (tankAState)-[:FLOW_TO]->()
      MATCH (tankBState:ContainerState)-[:STATE_OF]->(tankB)
      WHERE NOT (tankBState)-[:FLOW_TO]->()

      // Link operation to input states (both containers)
      CREATE (op)-[:WINERY_OP_INPUT]->(tankBState)
      CREATE (op)-[:WINERY_OP_INPUT]->(tankAState)

      // Create new state for Tank B (reduced qty)
      CREATE (tankBOutput:ContainerState {
        id: $operationId + '_tankB_output',
        qty: tankBState.qty - 50,
        unit: 'gal',
        composition: tankBState.composition,
        timestamp: datetime(),
        tenantId: 'winery1',
        createdAt: datetime()
      })
      CREATE (tankBOutput)-[:STATE_OF]->(tankB)
      CREATE (op)-[:WINERY_OP_OUTPUT]->(tankBOutput)

      // Create new state for Tank A (increased qty)
      CREATE (tankAOutput:ContainerState {
        id: $operationId + '_tankA_output',
        qty: tankAState.qty + 50,
        unit: 'gal',
        composition: tankAState.composition,
        timestamp: datetime(),
        tenantId: 'winery1',
        createdAt: datetime()
      })
      CREATE (tankAOutput)-[:STATE_OF]->(tankA)
      CREATE (op)-[:WINERY_OP_OUTPUT]->(tankAOutput)

      // Create flow relationships
      // Internal flow: Tank B remaining wine
      CREATE (tankBState)-[:FLOW_TO {
        qty: tankBState.qty - 50,
        unit: 'gal',
        composition: tankBState.composition
      }]->(tankBOutput)

      // Internal flow: Tank A original wine
      CREATE (tankAState)-[:FLOW_TO {
        qty: tankAState.qty,
        unit: 'gal',
        composition: tankAState.composition
      }]->(tankAOutput)

      // Cross-container flow: transferred wine from Tank B to Tank A
      CREATE (tankBState)-[:FLOW_TO {
        qty: 50,
        unit: 'gal',
        composition: tankBState.composition
      }]->(tankAOutput)

      RETURN id(op) AS opId
    `,
    { operationId }
  );

  console.log(`✅ Success: ${result.records.length} records returned`);
  
  // 3. Verify
  const verifyResult = await session.run(
    `
    MATCH (tankA:Container {id: 'tankA'})<-[:STATE_OF]-(sa:ContainerState)
    WHERE NOT (sa)-[:FLOW_TO]->()
    MATCH (tankB:Container {id: 'tankB'})<-[:STATE_OF]-(sb:ContainerState)
    WHERE NOT (sb)-[:FLOW_TO]->()
    RETURN sa.qty as qtyA, sb.qty as qtyB
    `
  );

  const qtyA = verifyResult.records[0].get("qtyA").toNumber();
  const qtyB = verifyResult.records[0].get("qtyB").toNumber();

  console.log(`Tank A Qty: ${qtyA} (Expected 1050)`);
  console.log(`Tank B Qty: ${qtyB} (Expected 450)`);

  if (qtyA !== 1050 || qtyB !== 450) {
    throw new Error("Cypher logic failed verification.");
  }
});
