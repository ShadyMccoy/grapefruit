import { getDriver } from "../client";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { ContainerState } from "../../domain/nodes/ContainerState";

export class WineryOperationRepo {
  static async createOperation(op: WineryOperation): Promise<string> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const opId = await session.executeWrite(async (tx) => {
        // Intent: Minimal, deterministic write. Single MATCH phase for existing inputs/containers, then CREATE everything else. No MERGE, no dynamic string building.
        // Reasoning: Containers are timelines; each operation appends new ContainerState nodes and FLOW_TO edges from prior states.

        const query = `
          CREATE (op:WineryOperation {
            id: $id,
            type: $type,
            description: $description,
            tenantId: $tenantId,
            createdAt: datetime($createdAt)
          })
          WITH op, $inputStateIds AS inputIds, $outputSpecs AS specs, $flows AS flows, $createdAt AS createdAtIso, $tenantId AS tenant
          // Bind all input states once
          UNWIND inputIds AS inId
          MATCH (inState:ContainerState {id: inId})
          CREATE (op)-[:WINERY_OP_INPUT]->(inState)
          WITH op, collect(inState) AS inStates, specs, flows, createdAtIso, tenant
          // Create all outputs and link to containers and op
          UNWIND specs AS spec
          MATCH (c:Container {id: spec.containerId})
          CREATE (out:ContainerState {
            id: spec.stateId,
            qty: toInteger(spec.qty),
            unit: spec.unit,
            composition: spec.composition,
            timestamp: datetime(createdAtIso),
            tenantId: tenant,
            createdAt: datetime(createdAtIso)
          })
          CREATE (out)-[:STATE_OF]->(c)
          CREATE (op)-[:WINERY_OP_OUTPUT]->(out)
          // Maintain CURRENT_STATE pointer on the container timeline
          WITH op, inStates, out, c, flows
          OPTIONAL MATCH (c)-[old:CURRENT_STATE]->(:ContainerState)
          DELETE old
          CREATE (c)-[:CURRENT_STATE]->(out)
          WITH op, inStates, collect(out) AS outStates, flows
          // Create lineage FLOW_TO by index
          UNWIND flows AS f
          WITH op, inStates, outStates, f
          WITH op, inStates[toInteger(f.from)] AS fromState, outStates[toInteger(f.to)] AS toState, f
          CREATE (fromState)-[:FLOW_TO {
            qty: toInteger(f.qty),
            nominalDollars: toInteger(f.nominalDollars),
            realDollars: toInteger(f.realDollars),
            deltaTime: duration({seconds: toInteger(f.deltaTime)})
          }]->(toState)
          WITH op
          RETURN op.id AS opId
        `;

        const params: Record<string, any> = {
          id: op.id,
          type: op.type,
          description: op.description ?? null,
          tenantId: op.tenantId,
          createdAt: op.createdAt.toISOString(),
          inputStateIds: op.inputStateIds || [],
          outputSpecs: (op.outputSpecs || []).map(s => ({
            containerId: s.containerId,
            stateId: s.stateId,
            qty: s.qty,
            unit: s.unit,
            composition: JSON.stringify(s.composition)
          })),
          flows: (op.flows || []).map(f => ({
            from: f.from,
            to: f.to,
            qty: f.qty,
            nominalDollars: f.composition?.nominalDollars ?? 0,
            realDollars: f.composition?.realDollars ?? 0,
            deltaTime: (f as any).deltaTime ?? 0
          }))
        };

        const result = await tx.run(query, params);
        return result.records[0].get("opId");
      });

      return opId;
    } finally {
      await session.close();
    }
  }

  static async getOperation(id: string): Promise<WineryOperation | null> {
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
      const inputStates = record.get("inputStates").map((s: any) => ({
        ...s.properties,
        createdAt: new Date(s.properties.createdAt),
        timestamp: new Date(s.properties.timestamp),
        composition: s.properties.composition ? JSON.parse(s.properties.composition) : undefined
      } as ContainerState));
      const outputStates = record.get("outputStates").map((s: any) => ({
        ...s.properties,
        createdAt: new Date(s.properties.createdAt),
        timestamp: new Date(s.properties.timestamp),
        composition: s.properties.composition ? JSON.parse(s.properties.composition) : undefined
      } as ContainerState));
      const lossState = record.get("lossState") && record.get("lossState").properties ? {
        ...record.get("lossState").properties,
        createdAt: new Date(record.get("lossState").properties.createdAt),
        timestamp: new Date(record.get("lossState").properties.timestamp),
        composition: record.get("lossState").properties.composition ? JSON.parse(record.get("lossState").properties.composition) : undefined
      } as ContainerState : undefined;

      return {
        ...opNode,
        createdAt: new Date(opNode.createdAt),
        inputStates,
        outputStates,
        lossState
      } as WineryOperation;
    } finally {
      await session.close();
    }
  }
}
