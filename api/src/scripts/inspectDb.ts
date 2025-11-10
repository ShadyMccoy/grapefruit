// src/scripts/inspectDb.ts
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("Inspecting database...");

    // Get operations
    const ops = await session.run('MATCH (op:WineryOperation) RETURN op.id AS id, op.type AS type, op.description AS desc');
    console.log("\nOperations:");
    ops.records.forEach(r => console.log(`  ${r.get('id')} - ${r.get('type')}: ${r.get('desc')}`));

    // Get states
    const states = await session.run('MATCH (s:ContainerState) RETURN s.id AS id, s.qty AS qty ORDER BY s.createdAt');
    console.log("\nContainer States:");
    states.records.forEach(r => console.log(`  ${r.get('id')}: ${r.get('qty')} gallons`));

    // Get containers
    const containers = await session.run('MATCH (c:Container) RETURN c.id AS id, c.name AS name');
    console.log("\nContainers:");
    containers.records.forEach(r => console.log(`  ${r.get('id')}: ${r.get('name')}`));

    // Check operation input relationships
    const opInputs = await session.run(`
      MATCH (op:WineryOperation)-[:WINERY_OP_INPUT]->(s:ContainerState)
      RETURN op.id AS opId, s.id AS stateId
      ORDER BY op.createdAt
    `);
    console.log("\nOperation inputs:");
    opInputs.records.forEach(r => console.log(`  ${r.get('opId')} <- ${r.get('stateId')}`));

  } finally {
    await session.close();
    await driver.close();
  }
}

main();