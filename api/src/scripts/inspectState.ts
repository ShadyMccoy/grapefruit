import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const stateId = 'state-tank-3-initial';
    console.log(`Inspecting ${stateId}...`);

    const nodeCountResult = await session.run(`
      MATCH (s:ContainerState {id: $id})
      RETURN count(s) as count
    `, { id: stateId });
    console.log(`Node count for ${stateId}: ${nodeCountResult.records[0].get('count')}`);

    const countResult = await session.run(`
      MATCH (s:ContainerState {id: $id})
      RETURN 
        size([(s)-[:FLOW_TO]->() | 1]) as flowCount,
        size([(s)<-[:WINERY_OP_INPUT]-() | 1]) as inputCount,
        size([(s)<-[:WINERY_OP_INPUT]-(:WineryOperation) | 1]) as opCount
    `, { id: stateId });

    const counts = countResult.records[0];
    console.log("Counts:");
    console.log(`  Outgoing Flows: ${counts.get('flowCount')}`);
    console.log(`  Input Relationships: ${counts.get('inputCount')}`);

    // Get distinct targets and ops
    const distinctResult = await session.run(`
      MATCH (s:ContainerState {id: $id})
      OPTIONAL MATCH (s)-[r:FLOW_TO]->(t:ContainerState)
      OPTIONAL MATCH (op:WineryOperation)-[rin:WINERY_OP_INPUT]->(s)
      RETURN 
        collect(DISTINCT t.id) as targets,
        collect(DISTINCT op.id) as ops,
        collect(DISTINCT elementId(op)) as opNodeIds,
        collect(DISTINCT elementId(r)) as flowRelIds,
        collect(DISTINCT elementId(rin)) as inputRelIds
    `, { id: stateId });

    const distinct = distinctResult.records[0];
    console.log("Distinct Targets:", distinct.get('targets'));
    console.log("Distinct Ops (IDs):", distinct.get('ops'));
    console.log("Distinct Op Nodes (ElementIDs):", distinct.get('opNodeIds'));
    console.log("Distinct Flow Rel IDs:", distinct.get('flowRelIds'));
    console.log("Distinct Input Rel IDs:", distinct.get('inputRelIds'));

    const result = await session.run(`
      MATCH (s:ContainerState {id: $id})
      OPTIONAL MATCH (s)-[r:FLOW_TO]->(t:ContainerState)
      OPTIONAL MATCH (op:WineryOperation)-[:WINERY_OP_INPUT]->(s)
      RETURN s, r, t, op
    `, { id: stateId });

    if (result.records.length === 0) {
      console.log("State not found.");
    } else {
      console.log(`Found ${result.records.length} records (paths).`);
      result.records.forEach((record, i) => {
        const s = record.get('s').properties;
        const r = record.get('r');
        const t = record.get('t');
        const op = record.get('op'); // This would be the operation that *consumed* s? No, WINERY_OP_INPUT points Op -> State. 
        // Wait, WINERY_OP_INPUT is Op -> InputState. So if 's' is an input, 'op' is the operation using it.
        
        console.log(`--- Record ${i + 1} ---`);
        console.log(`State: ${s.id} (Qty: ${s.qty})`);
        
        if (r) {
            console.log(`  Flows To: ${t.properties.id} (Qty: ${r.properties.qty})`);
            console.log(`  Rel Props:`, r.properties);
        } else {
            console.log(`  No outgoing flow.`);
        }

        if (op) {
             console.log(`  Used in Op: ${op.properties.id} (${op.properties.type})`);
        }
      });
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
