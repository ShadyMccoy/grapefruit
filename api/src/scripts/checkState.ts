import { getDriver } from "../db/client";

async function checkState() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("Checking ContainerState: 88bb1f28-e083-4a5d-8cf3-e71f2cd3b13d");

    // Check operations outputting to this state
    const opsResult = await session.run(`
      MATCH (op:WineryOperation)-[:WINERY_OP_OUTPUT]->(s:ContainerState {id: "88bb1f28-e083-4a5d-8cf3-e71f2cd3b13d"})
      RETURN op.id as opId, op.type as type, op.createdAt as createdAt
    `);
    console.log(`\nOperations outputting to this state: ${opsResult.records.length}`);
    opsResult.records.forEach(r => {
      console.log(`  - ${r.get('opId')} (${r.get('type')}) at ${r.get('createdAt')}`);
    });

    // Check if there are multiple operations with the same ID
    const dupOps = await session.run(`
      MATCH (op:WineryOperation {id: "perf-op-14-11"})
      RETURN count(op) as count
    `);
    console.log(`\nOperations with ID 'perf-op-14-11': ${dupOps.records[0].get('count')}`);

    // Check relationships
    const rels = await session.run(`
      MATCH (op:WineryOperation {id: "perf-op-14-11"})-[r:WINERY_OP_OUTPUT]->(s:ContainerState {id: "88bb1f28-e083-4a5d-8cf3-e71f2cd3b13d"})
      RETURN count(r) as count
    `);
    console.log(`Relationships from op to state: ${rels.records[0].get('count')}`);

    // Check if this is the current state
    const currentResult = await session.run(`
      MATCH (c:Container {id: "tank-21"})-[:CURRENT_STATE]->(s:ContainerState)
      RETURN s.id as stateId, s.createdAt as createdAt
    `);
    console.log(`\nCurrent state for tank-21: ${currentResult.records.length} states`);
    currentResult.records.forEach(r => {
      console.log(`  - ${r.get('stateId')} at ${r.get('createdAt')}`);
    });

    // Check all states for this container
    const allStatesResult = await session.run(`
      MATCH (c:Container {id: "tank-21"})<-[:STATE_OF]-(s:ContainerState)
      RETURN s.id as stateId, s.createdAt as createdAt
      ORDER BY s.createdAt DESC
      LIMIT 10
    `);
    console.log(`\nRecent states for tank-21: ${allStatesResult.records.length}`);
    allStatesResult.records.forEach(r => {
      console.log(`  - ${r.get('stateId')} at ${r.get('createdAt')}`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkState();