# 🍇 Grapefruit Graph Model

This document defines the **ontology**, **relationships**, **invariants**, and **temporal mechanics** of Grapefruit’s winery graph.  
It is the canonical reference for reasoning about truth, lineage, balance, and time in winemaking operations.

---

## 🧭 Overview

Grapefruit represents the winery as a **directed acyclic graph (DAG)**:

- **Nodes:** containers, states, operations, and observations.  
- **Edges:** flows of volume and composition over time (ΔT), and ownership/lineage relationships.  

Each node and edge encodes **physical transformations, monetary flow, and traceability**.

---

## 🧱 Node Types

| Node | Description |
|------|--------------|
| **Tenant** | Logical boundary for multi-winery support. |
| **Container** | Physical or virtual vessel (tank, barrel, bottle, gain/loss, loss). |
| **ContainerState** | Immutable snapshot of a container’s contents at an absolute timestamp T. Holds volume, composition, and metadata. |
| **Operation** | Transformation consuming input states and producing output states. Contains metadata about the operation. |
| **Observation** | Optional measurement or correction associated with a container state. |
| **CurrentState** | Special node representing the live state of a container. Updated daily, timestamp = now. |

---

## 🔗 Relationship Types

| Relationship | Direction | Description |
|---------------|------------|--------------|
| `STATE_OF` | `ContainerState → Container` | Links a state to its container. |
| `FLOW_TO` | `ContainerState → ContainerState` | Represents movement of volume/composition with ΔT. Sum of outgoing relationships = 0 (except virtual L). |
| `OBSERVATION_OF` | `Observation → ContainerState` | Links measurements or corrections. |
| `OWNED_BY` | `* → Tenant` | Associates nodes with their owning tenant. |
| `CURRENT_STATE` | `Container → ContainerState` | Pointer to the live state; ΔT of incoming flows updated daily. |
| `OP_RELATED_STATE_IN` | `Operation → ContainerState` | Links operation to input states. |
| `OP_RELATED_STATE_OUT` | `Operation → ContainerState` | Links operation to output states. |
| `OPERATION_LOSS` | `Operation → ContainerState` | Links operation to loss/gain states. |

---

## 🧮 Invariants

1. **Conservation of Volume**  
   - `Σ input.volume = Σ output.volume ± explicit losses`
2. **Lineage Continuity**  
   - Each `ContainerState` has exactly one predecessor (except initial states).
3. **Single Current State per Container**  
   - A container can have only one active state at any given time.
4. **Nominal Dollar Conservation**  
   - `Σ input.nominal = Σ output.nominal`
5. **Real Dollar Flow**  
   - Real dollars only flow with physical wine, not gain/loss adjustments.
6. **Immutability**  
   - States and operations are append-only; history is never overwritten.

---

## 🧠 Virtual Containers

### **Gain/Loss**
- Captures observed discrepancies or small corrections.
- Adds **nominal dollars** but no **real dollars**.
- Treated as a first-class container in the graph.
- Represents physical losses (evaporation, spoilage, spills).
- Reduces **real dollars**, preserves **nominal dollars**.
- Allows negative flows for gains

---

## 🧩 Algebraic Model

Each Operation will point to several container states:

1. Each **input** container state.
  for example for container A, represent the container state A(n)
2. A corresponding **output** container state
  A(n+1)
3. Potentially a Loss container L

Each of the input container states:
1. Has outgoing FLOW_TO relationships to the output or Loss container states
2. Outgoing flow relationships "compositions" add up to the  from container state
3. Conversely, the output container states all have at least one relationship to the input state
4. The new composition (container state) of the input state A(n) = A(n-1) + Sum(incoming FLOW_TO)

Loss container is excempt from the restrictions and may be unbalanced during an operation.
The incoming flow_to break down specifically on which containers the losses (or gains, represented as negative losses) are recorded; either pre or post op, and the composition of the relationship matches the from container for pre-losses, and the to-state on post-losses.

---

## 🕸️ Schema Visualization (Simplified)

(ContainerState)-[:STATE_OF]->(Container)
(ContainerState)-[:FLOW_TO]->(ContainerState)
(Operation)-[:OP_RELATED_STATE_IN]->(ContainerState)
(Operation)-[:OP_RELATED_STATE_OUT]->(ContainerState)
(Operation)-[:OPERATION_LOSS]->(ContainerState)
(ContainerState)<-[:OBSERVATION_OF]-(Observation)
(* )-[:OWNED_BY]->(Tenant)