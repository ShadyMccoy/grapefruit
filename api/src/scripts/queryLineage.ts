import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    // 1. Pick a random head state with incoming flows (history)
    const result = await session.run(`
      MATCH (c:Container)-[:CURRENT_STATE]->(s:ContainerState)
      MATCH (s)<-[:FLOW_TO]-(prev)
      RETURN s, c
      LIMIT 1
    `);

    if (result.records.length === 0) {
      console.log("No active states found.");
      return;
    }

    const stateId = result.records[0].get("s").properties.id;
    const containerName = result.records[0].get("c").properties.name;

    console.log(`\n🔍 Tracing lineage for: ${containerName} (State: ${stateId})`);

    // 2. Query Provenance (Upstream)
    // Find all paths leading TO this state
    const provenanceResult = await session.run(`
      MATCH p = (ancestor:ContainerState)-[:FLOW_TO*]->(target:ContainerState {id: $stateId})
      RETURN p
      LIMIT 50
    `, { stateId });

    console.log(`\nFound ${provenanceResult.records.length} upstream paths.`);
    
    // Let's print the immediate parents
    const parentsResult = await session.run(`
      MATCH (parent:ContainerState)-[r:FLOW_TO]->(target:ContainerState {id: $stateId})
      MATCH (parent)-[:STATE_OF]->(pc:Container)
      RETURN pc.name as container, r.qty as qty, parent.id as stateId
    `, { stateId });

    console.log("\nImmediate Parents:");
    parentsResult.records.forEach(r => {
        console.log(` - From ${r.get("container")} (${r.get("qty")} h-units) [State: ${r.get("stateId")}]`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
