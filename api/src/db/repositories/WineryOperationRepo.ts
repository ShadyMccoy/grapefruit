import neo4j from "neo4j-driver";
import { getDriver } from "../client";
import { WineryOperation } from "../../domain/nodes/WineryOperation";
import { ContainerState } from "../../domain/nodes/ContainerState";
import {
  serializeAttributes,
  deserializeAttributes,
} from "../../util/attributeSerialization";

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
            createdAt: datetime(createdAtIso),
            containerId: c.id
          })
          CREATE (out)-[:STATE_OF]->(c)
          CREATE (op)-[:WINERY_OP_OUTPUT]->(out)
          // Maintain CURRENT_STATE pointer on the container timeline
          WITH op, inStates, out, c, flows
          MATCH (otherState:ContainerState)-[:STATE_OF]->(c)
          WHERE otherState <> out
          SET otherState.isHead = false
          SET out.isHead = true
          WITH op, inStates, out, c, flows
          OPTIONAL MATCH (c)-[oldRel:CURRENT_STATE]->(:ContainerState)
          DELETE oldRel
          CREATE (c)-[:CURRENT_STATE]->(out)
          WITH op, inStates, collect(out) AS outStates, flows
          // Intent: Create lineage FLOW_TO relationships using FlowToProps type structure
          // Reasoning: FLOW_TO properties (qty, unit, composition, deltaTime) align with domain model
          UNWIND flows AS f
          WITH op, inStates, outStates, f
          WITH op, inStates[toInteger(f.from)] AS fromState, outStates[toInteger(f.to)] AS toState, f
          CREATE (fromState)-[:FLOW_TO {
            qty: toInteger(f.qty),
            unit: f.unit,
            composition: f.composition,
            deltaTime: duration({seconds: toInteger(f.deltaTime)})
          }]->(toState)
          WITH op
          RETURN op.id AS opId
        `;

        const inputStateIndexMap = new Map<string, number>();
        (op.inputStates || []).forEach((state, index) => {
          inputStateIndexMap.set(state.id, index);
        });

        const outputStateIndexMap = new Map<string, number>();
        (op.outputStates || []).forEach((state, index) => {
          outputStateIndexMap.set(state.id, index);
        });

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
          flows: (op.flows || []).map(f => {
            const fromIndex = inputStateIndexMap.get(f.from.id);
            const toIndex = outputStateIndexMap.get(f.to.id);
            if (fromIndex === undefined || toIndex === undefined) {
              throw new Error(`Unexpected flow references missing state index: ${f.from.id} -> ${f.to.id}`);
            }
            return {
              from: fromIndex,
              to: toIndex,
              qty: neo4j.int(f.properties.qty),
              unit: f.properties.unit,
              composition: serializeAttributes(f.properties.attributes),
              deltaTime: f.properties.deltaTime ?? 0
            };
          })
        };

        const result = await tx.run(query, params);
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
          isHead: props.isHead ?? false,
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
  }
}
