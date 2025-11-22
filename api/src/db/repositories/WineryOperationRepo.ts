import neo4j from "neo4j-driver";
import { getDriver } from "../client";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { ContainerState } from "../../domain/nodes/ContainerState";
import {
  serializeAttributes,
  deserializeAttributes,
} from "../../util/attributeSerialization";
import { perf } from "../../util/PerformanceMonitor";

export class WineryOperationRepo {
  static async createOperation(op: WineryOperation): Promise<string> {
    return perf.measure("WineryOperationRepo.createOperation", async () => {
      const tSession = perf.start("SessionAcquire");
      const driver = getDriver();
      const session = driver.session();
      perf.end("SessionAcquire", tSession);

      try {
        const opId = await session.executeWrite(async (tx) => {
          const query = `
          // 0. Validate Invariants (Input States Current)
          UNWIND $inputStateIds AS checkId
          MATCH (s) WHERE s.id = checkId AND (s:ContainerState OR s:WeighTag)
          OPTIONAL MATCH (s)-[r:FLOW_TO]->()
          WITH checkId, count(r) as spentCount
          // If any input state has outgoing flows, it's not current.
          // We use a division by zero to force a transaction rollback if this invariant is violated.
          // In a real production system, we might use APOC or a more graceful error handling mechanism.
          WITH checkId, spentCount, 
               CASE WHEN spentCount > 0 THEN 1/0 ELSE 0 END as _ignored
          
          // Aggregate back to single row to prevent duplicate operation creation
          WITH count(*) as validated

          CREATE (op:WineryOperation {
            id: $id,
            type: $type,
            description: $description,
            tenantId: $tenantId,
            createdAt: datetime($createdAt)
          })
          
          // 1. Bind Input States
          WITH op, $inputStateIds AS inputIds
          CALL {
            WITH op, inputIds
            UNWIND inputIds AS inId
            MATCH (inState) WHERE inState.id = inId AND (inState:ContainerState OR inState:WeighTag)
            CREATE (op)-[:WINERY_OP_INPUT]->(inState)
          }
          
          // 2. Create Output States
          WITH op, $outputSpecs AS specs, $createdAt AS createdAtIso, $tenantId AS tenant
          CALL {
            WITH op, specs, createdAtIso, tenant
            UNWIND specs AS spec
            MATCH (c:Container {id: spec.containerId})
            CREATE (out:ContainerState {
              id: spec.stateId,
              qty: toInteger(spec.qty),
              unit: spec.unit,
              composition: spec.composition,
              timestamp: datetime(createdAtIso),
              tenantId: tenant,
              createdAt: datetime(createdAtIso),
              containerId: c.id
            })
            CREATE (out)-[:STATE_OF]->(c)
            CREATE (op)-[:WINERY_OP_OUTPUT]->(out)
            
            // Update Container Head (CURRENT_STATE)
            WITH out, c
            // Lock container to prevent race conditions
            SET c._lock = 1 REMOVE c._lock
            WITH out, c
            OPTIONAL MATCH (c)-[oldRel:CURRENT_STATE]->(:ContainerState)
            DELETE oldRel
            CREATE (c)-[:CURRENT_STATE]->(out)

            // Snapshot Barrel Group Membership
            // If this container is a group, link its current members to this new state
            WITH out, c
            OPTIONAL MATCH (b:Container)-[:MEMBER_OF]->(c)
            FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END |
              CREATE (b)-[:SNAPSHOT_MEMBER_OF]->(out)
            )
          }
          
          // 3. Create Flows
          WITH op, $flows AS flows
          CALL {
            WITH flows
            UNWIND flows AS f
            MATCH (fromState) WHERE fromState.id = f.fromId AND (fromState:ContainerState OR fromState:WeighTag)
            MATCH (toState:ContainerState {id: f.toId})
            CREATE (fromState)-[:FLOW_TO {
              qty: toInteger(f.qty),
              unit: f.unit,
              composition: f.composition,
              deltaTime: duration({seconds: toInteger(f.deltaTime)})
            }]->(toState)
          }
          
          RETURN op.id AS opId
        `;

          const tParam = perf.start("ParamSerialization");
          const params: Record<string, any> = {
            id: op.id,
            type: op.type,
            description: op.description ?? null,
            tenantId: op.tenantId,
            createdAt: op.createdAt.toISOString(),
            inputStateIds: op.inputStates?.map(s => s.id) || [],
            outputSpecs: (op.outputStates || []).map(s => ({
              containerId: s.container.id,
              stateId: s.id,
              qty: neo4j.int(s.quantifiedComposition.qty),
              unit: s.quantifiedComposition.unit,
              composition: serializeAttributes(s.quantifiedComposition.attributes)
            })),
            flows: (op.flows || []).map(f => ({
              fromId: f.from.id,
              toId: f.to.id,
              qty: neo4j.int(f.properties.qty),
              unit: f.properties.unit,
              composition: serializeAttributes(f.properties.attributes),
              deltaTime: f.properties.deltaTime ?? 0
            }))
          };
          perf.end("ParamSerialization", tParam);

          const tTxRun = perf.start("TxRun");
          const result = await tx.run(query, params);
          perf.end("TxRun", tTxRun);
          
          if (result.summary) {
            const { resultAvailableAfter, resultConsumedAfter } = result.summary;
            perf.recordMetric("DB:CypherExecution", resultAvailableAfter.toNumber());
            perf.recordMetric("DB:ResultConsume", resultConsumedAfter.toNumber());
          }

          if (result.records.length === 0) {
            console.error("WineryOperation create returned no rows", params);
            throw new Error("Failed to create winery operation");
          }
          return result.records[0].get("opId");
        });

        return opId;
      } finally {
        await session.close();
      }
    });
  }

  static async getOperation(id: string): Promise<WineryOperation | null> {
    return perf.measure("WineryOperationRepo.getOperation", async () => {
      const driver = getDriver();
      const session = driver.session();

      try {
        const result = await session.executeRead(async (tx) => {
          return await tx.run(
            `
            MATCH (op:WineryOperation {id: $id})
            OPTIONAL MATCH (op)-[:WINERY_OP_INPUT]->(inputState:ContainerState)
            OPTIONAL MATCH (op)-[:WINERY_OP_OUTPUT]->(outputState:ContainerState)
            OPTIONAL MATCH (op)-[:OPERATION_LOSS]->(lossState:ContainerState)
            RETURN op,
                   collect(DISTINCT inputState) AS inputStates,
                   collect(DISTINCT outputState) AS outputStates,
                   head(collect(DISTINCT lossState)) AS lossState
            `,
            { id }
          );
        });

        if (result.records.length === 0) return null;

        const record = result.records[0];
        const opNode = record.get("op").properties;

        const hydrateState = (node: any): ContainerState | undefined => {
          if (!node) return undefined;
          const props = node.properties;
          return {
            id: props.id,
            tenantId: props.tenantId,
            createdAt: new Date(props.createdAt),
            timestamp: new Date(props.timestamp),
            container: { id: props.containerId ?? "" } as any,
            quantifiedComposition: {
              qty: neo4j.isInt(props.qty) ? props.qty.toBigInt() : BigInt(props.qty),
              unit: props.unit,
              attributes: deserializeAttributes(props.composition ?? "{}"),
            },
            flowsTo: [],
            flowsFrom: [],
          } as ContainerState;
        };

        const inputStates = (record.get("inputStates") as any[])
          .map((s) => hydrateState(s))
          .filter(Boolean) as ContainerState[];
        const outputStates = (record.get("outputStates") as any[])
          .map((s) => hydrateState(s))
          .filter(Boolean) as ContainerState[];
        const lossState = hydrateState(record.get("lossState"));


        return {
          ...opNode,
          createdAt: new Date(opNode.createdAt),
          inputStates,
          outputStates,
          lossState,
        } as WineryOperation;
      } finally {
        await session.close();
      }
    });
  }

  static async findAll(limit: number = 100): Promise<WineryOperation[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (op:WineryOperation)
        RETURN op
        ORDER BY op.createdAt DESC
        LIMIT toInteger($limit)
        `,
        { limit }
      );

      return result.records.map((record) => {
        const opNode = record.get("op").properties;
        return {
          ...opNode,
          createdAt: new Date(opNode.createdAt),
        } as WineryOperation;
      });
    } finally {
      await session.close();
    }
  }
}
