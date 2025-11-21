import { getDriver } from "../client";
import { perf } from "../../util/PerformanceMonitor";

export interface LineageNode {
  id: string;
  containerId: string;
  containerName: string;
  qty: bigint;
  timestamp: string;
}

export interface LineageEdge {
  fromId: string;
  toId: string;
  qty: bigint;
  opId?: string;
  opType: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export class LineageRepo {
  static async getUpstreamLineage(stateId: string, depth: number = 5): Promise<LineageGraph> {
    return perf.measure(`LineageRepo.getUpstreamLineage(depth=${depth})`, async () => {
      const driver = getDriver();
      const session = driver.session();

      try {
        const result = await session.executeRead(async (tx) => {
          const query = `
            MATCH (target:ContainerState {id: $stateId})
            MATCH p = (ancestor:ContainerState)-[:FLOW_TO*1..${depth}]->(target)
            UNWIND relationships(p) as r
            WITH DISTINCT r
            WITH startNode(r) as start, endNode(r) as end, r
            
            // Fetch connected Containers
            MATCH (start)-[:STATE_OF]->(startC:Container)
            MATCH (end)-[:STATE_OF]->(endC:Container)
            
            // Fetch Operation that produced the end state
            OPTIONAL MATCH (op:WineryOperation)-[:WINERY_OP_OUTPUT]->(end)
            
            RETURN 
                start, startC, 
                r, 
                end, endC, 
                op
          `;
          
          // Let's use a pure Cypher approach for now to avoid APOC dependency if not installed
          // This query finds all paths upstream up to 'depth' hops
          // OPTIMIZATION: We unwind and deduplicate relationships on the server side
          // to avoid sending millions of redundant path segments over the wire.
          return await tx.run(query, { stateId });
        });

        const nodes = new Map<string, LineageNode>();
        const edges: LineageEdge[] = [];

        if (result.summary) {
            const { resultAvailableAfter, resultConsumedAfter } = result.summary;
            perf.recordMetric("DB:LineageQuery", resultAvailableAfter.toNumber());
            perf.recordMetric("DB:LineageConsume", resultConsumedAfter.toNumber());
        }

        result.records.forEach(record => {
             const start = record.get("start");
             const startC = record.get("startC");
             const end = record.get("end");
             const endC = record.get("endC");
             const rel = record.get("r");
             const op = record.get("op");

             if (!nodes.has(start.properties.id)) {
                 nodes.set(start.properties.id, {
                     id: start.properties.id,
                     containerId: startC.properties.id,
                     containerName: startC.properties.name,
                     qty: BigInt(start.properties.qty),
                     timestamp: start.properties.timestamp
                 });
             }
             if (!nodes.has(end.properties.id)) {
                 nodes.set(end.properties.id, {
                     id: end.properties.id,
                     containerId: endC.properties.id,
                     containerName: endC.properties.name,
                     qty: BigInt(end.properties.qty),
                     timestamp: end.properties.timestamp
                 });
             }

             edges.push({
                 fromId: start.properties.id,
                 toId: end.properties.id,
                 qty: BigInt(rel.properties.qty),
                 opId: op ? op.properties.id : undefined,
                 opType: op ? op.properties.type : "unknown"
             });
        });

        return {
            nodes: Array.from(nodes.values()),
            edges
        };

      } finally {
        await session.close();
      }
    });
  }
}
