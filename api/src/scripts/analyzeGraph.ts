import { getDriver } from '../db/client';

async function analyze() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log("Analyzing Graph Topology...");

    // 1. Total Counts
    const countRes = await session.run(`
      MATCH (n) RETURN count(n) as nodes
    `);
    const relRes = await session.run(`
      MATCH ()-[r]->() RETURN count(r) as rels
    `);
    console.log(`Total Nodes: ${countRes.records[0].get('nodes')}`);
    console.log(`Total Relationships: ${relRes.records[0].get('rels')}`);

    // 2. Most Active Containers
    const activeRes = await session.run(`
      MATCH (s:ContainerState)-[:STATE_OF]->(c:Container)
      MATCH (op:WineryOperation)-[:WINERY_OP_INPUT|WINERY_OP_OUTPUT]-(s)
      RETURN c.name as container, count(DISTINCT op) as opCount
      ORDER BY opCount DESC
      LIMIT 5
    `);
    console.log("\nTop 5 Most Active Containers:");
    activeRes.records.forEach(r => {
      const container = r.get('container');
      const count = r.get('opCount');
      console.log(`  ${container}: ${count.toString()} operations`);
    });

    // Lineage calculation skipped for performance
    /*
    console.log("\nCalculating Max Lineage Depth (Sample)...");
    // 3. Max Lineage Depth (Approximate)
    // We limit the path length to avoid timeouts on dense graphs
    const depthRes = await session.run(`
      MATCH p = (start:ContainerState)-[:FLOW_TO*1..50]->(end)
      RETURN length(p) as depth
      ORDER BY depth DESC
      LIMIT 1
    `);
    if (depthRes.records.length > 0) {
        console.log(`\nMax Lineage Depth: ${depthRes.records[0].get('depth')} hops`);
    }
    */

  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

analyze();
