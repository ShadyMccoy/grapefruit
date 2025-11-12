# 🍇 Grapefruit Graph Model

Grapefruit domain objects are represented as a **directed acyclic graph (DAG)** to capture the flow of physical quantities, compositions, and monetary values through winery operations over time within a graph database (Neo4j). For domain object definitions, see [domain/README.md](../domain/README.md). For broader ontology details, see [docs/GRAPH_MODEL.md](../../docs/GRAPH_MODEL.md).

Graph data structures provide a natural way to model relationships and transformations, enabling efficient querying and analysis of complex winery processes.

Generally speaking, objects in the domain are represented as **nodes**, and the relationships between them as **edges**. Typically, when an object has another object as a property, this is represented as an edge in the graph.

---

## 🧱 Node Types

| Node | Description |
|------|--------------|
| **Tenant** | Logical boundary for multi-winery support. |
| **Container** | Physical or virtual vessel (tank, barrel, press, bottle, loss). |
| **ContainerState** | Immutable snapshot of a container’s contents at an absolute timestamp T. Holds qty (in h-units), unit, composition (varietals, real/nominal dollars), and metadata. |
| **WineryOperation** | Transformation consuming input states and producing output states. Contains metadata about the operation. |
| **Observation** | Optional measurement or correction associated with a container state. |
| **CurrentState** | Special node representing the live state of a container. Updated daily, timestamp = now. |

---

## 🔗 Relationship Types

| Relationship | Direction | Description |
|---------------|------------|--------------|
| `STATE_OF` | `ContainerState → Container` | Links a state to its container. |
| `FLOW_TO` | `ContainerState → ContainerState` | Represents movement of quantity/composition with ΔT. Sum of outgoing relationships = 0 (except virtual L). |
| `OBSERVATION_OF` | `Observation → ContainerState` | Links measurements or corrections. |
| `OWNED_BY` | `* → Tenant` | Associates nodes with their owning tenant. |
| `CURRENT_STATE` | `Container → ContainerState` | Pointer to the live state; ΔT of incoming flows updated daily. |
| `WINERY_OP_INPUT` | `WineryOperation → ContainerState` | Links operation to input states. |
| `WINERY_OP_OUTPUT` | `WineryOperation → ContainerState` | Links operation to output states. |
| `OPERATION_LOSS` | `WineryOperation → ContainerState` | Links operation to loss/gain states. |

---

## 🧮 Invariants

1. **Lineage Continuity**  
   - Each `ContainerState` has exactly one predecessor for the same container, except for initial states.
2. **Single Current State per Container**  
   - A container can have only one active state at any given time..
3. **Immutability**  
   - States and operations are append-only; history is never overwritten.

---

## 🕸️ Schema Visualization (Simplified)

(ContainerState)-[:STATE_OF]->(Container)
(ContainerState)-[:FLOW_TO]->(ContainerState)
(WineryOperation)-[:WINERY_OP_INPUT]->(ContainerState)
(WineryOperation)-[:WINERY_OP_OUTPUT]->(ContainerState)
(WineryOperation)-[:OPERATION_LOSS]->(ContainerState)
(ContainerState)<-[:OBSERVATION_OF]-(Observation)
(* )-[:OWNED_BY]->(Tenant)