// src/scripts/verifySeeding.ts
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("Verifying seeding...");

    // Check containers
    const containerResult = await session.run("MATCH (c:Container) RETURN count(c) as count");
    console.log(`Containers: ${containerResult.records[0].get('count').toNumber()}`);

    // Check container states
    const stateResult = await session.run("MATCH (s:ContainerState) RETURN count(s) as count");
    console.log(`Container States: ${stateResult.records[0].get('count').toNumber()}`);

    // Check operations
    const operationResult = await session.run("MATCH (o:WineryOperation) RETURN count(o) as count");
    console.log(`Winery Operations: ${operationResult.records[0].get('count').toNumber()}`);

    // Check all relationships
    const relationships = await session.run(`
      MATCH ()-[r]-()
      RETURN type(r) as relType, count(r) as count
      ORDER BY relType
    `);
    console.log("Relationships:");
    relationships.records.forEach(record => {
      console.log(`  ${record.get('relType')}: ${record.get('count').toNumber()}`);
    });

    // Check operation connections
    const opConnections = await session.run(`
      MATCH (op:WineryOperation)
      OPTIONAL MATCH (op)-[:WINERY_OP_INPUT]->(input:ContainerState)
      OPTIONAL MATCH (op)-[:WINERY_OP_OUTPUT]->(output:ContainerState)
      RETURN op.id as opId, count(DISTINCT input) as inputCount, count(DISTINCT output) as outputCount
    `);
    console.log("Operation connections:");
    opConnections.records.forEach(record => {
      console.log(`  ${record.get('opId')}: ${record.get('inputCount').toNumber()} inputs, ${record.get('outputCount').toNumber()} outputs`);
    });

  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();