# 🍇 Grapefruit Graph Model

This document defines the **ontology**, **relationships**, and **invariants** that make up Grapefruit’s core data model.  
It is the **canonical reference** for reasoning about truth, lineage, and balance within the winery graph.

---

## 🧭 Overview

Grapefruit represents the winery as a **directed acyclic graph (DAG)** of containers and operations.  
Every node and relationship encodes **physical transformations**, **monetary flow**, and **traceability**.

---

## 🧱 Node Types

| Node | Description |
|------|--------------|
| **Tenant** | Logical boundary for data isolation (multi-winery support). |
| **Container** | Physical or virtual vessel (tank, barrel, bottle, gain/loss, loss). |
| **ContainerState** | Snapshot of a container’s contents at a point in time. Immutable and versioned. |
| **Operation** | Transformation consuming input states and producing output states (transfer, blend, bottling). |
| **Observation** | Optional measurement or correction associated with a container state. |

---

## 🔗 Relationship Types

| Relationship | Direction | Description |
|---------------|------------|--------------|
| `STATE_OF` | `ContainerState → Container` | Links a state to its container. |
| `WINERY_OP_INPUT` | `ContainerState → Operation` | Defines the inputs to an operation. |
| `WINERY_OP_OUTPUT` | `Operation → ContainerState` | Defines the outputs from an operation. |
| `OBSERVATION_OF` | `Observation → ContainerState` | Links measurements or corrections. |
| `OWNED_BY` | `* → Tenant` | Associates nodes with their owning tenant. |

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

### **LossContainer**
- Represents physical losses (evaporation, spoilage, spills).
- Reduces **real dollars**, preserves **nominal dollars**.
- Modeled as a negative input to an operation.

---

## 🧩 Algebraic Model

Each operation enforces balance:

Σ(inputs.volume) + Σ(gains) - Σ(losses) = Σ(outputs.volume)
Σ(inputs.nominal) = Σ(outputs.nominal)
Σ(inputs.real) - Σ(losses.real) = Σ(outputs.real)

---

## 🕸️ Schema Visualization (Simplified)

(ContainerState)-[:STATE_OF]->(Container)
(ContainerState)-[:WINERY_OP_INPUT]->(Operation)
(Operation)-[:WINERY_OP_OUTPUT]->(ContainerState)
(ContainerState)<-[:OBSERVATION_OF]-(Observation)
(* )-[:OWNED_BY]->(Tenant)