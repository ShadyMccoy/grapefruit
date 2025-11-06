# **Grapefruit 🍇**

**Grapefruit** gives wineries auditable, time-traveling traceability for every tank, barrel, and bottling — built for seamless integration with ERP systems.

It models the winery as a directed graph of containers (tanks, barrels, presses) and operations (transfers, blends, bottling). Each operation generates new container *states* linked to their inputs, allowing the entire production history to be reconstructed at any point in time — with guaranteed mathematical balance between what goes in and what comes out.

The result is a single, authoritative source of truth for material flow, blends, and transformations. Grapefruit provides the foundation for transparent audits, regulatory compliance, and accurate cost accounting across every stage of production.

*Why “Grapefruit”?* A nod to fruit, lineage, and clarity, and the project needed a name for reference.

---

## **About This Document**

This README is written primarily for **AI collaborators and code-generation systems**.  
It defines the conceptual boundaries, design principles, and invariants that guide Grapefruit’s implementation.  

When generating or modifying code, treat this document as the **authoritative context** for reasoning about Grapefruit’s architecture and intent.  
It describes *why* the system exists, *what truths must remain invariant*, and *how abstractions relate to one another.*

Human contributors are welcome — and encouraged — to work alongside AI collaborators, but all participants should reason from the same foundation: the design principles and ontology defined here.

---

## **Design Principles**

### 1. Truth
The system’s primary goal is to model **what actually happened** in the cellar — not what was planned or intended.  
Truth in Grapefruit is immutable and mathematically verifiable. Every operation must balance inputs and outputs exactly; losses are explicit, never implicit.

### 2. Auditability
All data must be reconstructable and explainable.  
A user (human or AI) should be able to:
- Trace any container’s contents back to its origins.  
- Prove conservation of volume through every operation.  
- Recreate the full state of the winery at any past moment.

### 3. Traceability
The graph structure must encode full lineage:  
each *container state* knows its *predecessor(s)*, and each *operation* connects inputs to outputs.  
Traceability emerges naturally from this structure — not as an added feature.

### 4. Separation of Concerns
- **Truth Layer (Core Model):** Graph-based representation of physical transformations. Immutable and universal.  
- **Workflow Layer (Domain Logic):** Winery-specific processes, validations, and user interactions. Configurable, external, and replaceable.  
- **Integration Layer:** Interfaces with ERP systems, lab data, and production equipment. Bridges but does not alter truth.

### 5. Determinism
Given identical inputs and prior state, the system must always produce identical results.  
Randomness, timestamps, or environmental variance should never affect graph integrity.

### 6. Composability
Operations, containers, and workflows should be modular and composable — allowing complex processes (e.g., blending, bottling) to be built from smaller primitives without breaking auditability.

---

## **Core Concepts**

| Concept | Description |
|----------|--------------|
| **Tenant** | Logical owner of all containers, operations, and states. Enables multi-winery environments. |
| **Container** | A physical vessel: tank, barrel, press, etc. |
| **State** | A point-in-time record of a container’s contents. Each state has exactly one predecessor. |
| **Operation** | A transformation that consumes one or more states and produces new ones (e.g., transfer, blend, bottle). |
| **Snapshot** | A reconstruction of all container states at a specific moment. Enables time travel, audits, and versioning. |

---

## **Architecture Overview**

- **Backend:** Node.js + TypeScript  
- **Database:** Neo4j 5.x (with APOC plugin)  
- **API Layer:** Express REST endpoints  
- **Containerization:** Docker + docker-compose  
- **Frontend (planned):** React + visualization components (Sankey diagrams, lineage maps)  

> To run Grapefruit locally, see [**GETTING_STARTED.md**](./GETTING_STARTED.md).

---

# Application Design

## Typed Domain Layer & Repositories

To ensure Grapefruit’s prototype and future production code are **safe, maintainable, and auditable**, we are establishing a **strongly-typed domain layer** with corresponding repositories:

### 1. Domain Layer
- **Purpose:** Defines the canonical, immutable “truth objects” of Grapefruit in TypeScript.
- **Core interfaces:**
  - `BaseNode` — shared properties (`id`, `tenantId`, `createdAt`)
  - `Container` — physical vessels (`tank`, `barrel`, `press`) with capacity
  - `ContainerState` — snapshot of a container’s contents at a point in time
  - `Operation` — transformations consuming and producing container states (`transfer`, `blend`, `bottle`)
- **Benefits:**
  - Type safety ensures that every operation is consistent with the ontology.
  - Helps IDEs catch errors before hitting Neo4j.
  - Supports composable invariants and future GraphQL or REST APIs.

### 2. Repository Layer
- **Purpose:** Typed interface between the domain objects and Neo4j.
- **Examples:**
  - `ContainerRepo` — create/find containers
  - `ContainerStateRepo` — create/find states, retrieve current state
  - `OperationRepo` — create/find operations
- **Benefits:**
  - Encapsulates Cypher queries and session handling.
  - Returns fully typed objects ready for invariants and API layers.
  - Centralizes DB logic to simplify refactoring and testing.

### 3. Invariants Module
- **Purpose:** Enforces Grapefruit’s core truths before any mutation is committed.
- **Example invariants:**
  - Each container has at most one current state.
  - Operations conserve volume.
  - Container states have exactly one predecessor (except initial).
- **Integration:** Called in the service layer or before repository writes to protect graph integrity.

### 4. Prototype Flow
- TypeScript ensures **compile-time correctness**.
- Repositories handle DB interaction.
- Invariants ensure **runtime truth**.
- This setup allows a **prototype that is already production-quality in terms of typing and correctness**.

### Next Steps
- Populate `ContainerStateRepo` and `OperationRepo` with typed queries.  
- Implement “Hello World” scripts to query containers and validate typing.  
- Extend GraphQL/REST API layer using typed domain objects.

---

This ensures that Grapefruit is **prototype-safe, strongly typed, and ready for audit-compliant operations**, while keeping development fast and error-resistant.

## Winery Operation (Mental Model)

A `WineryOperation` represents a physical transformation of material in the winery (e.g., blending, transfer, bottling). It connects **input container states** to **output container states**, preserving:

- Exact volumes consumed and produced  
- Lineage for every container at every point in time  
- Traceability for auditing and cost calculation  

**Example: Pouring TankB into TankA**

| Container | Initial Volume | Input into Operation | Output from Operation |
|-----------|----------------|--------------------|---------------------|
| TankA     | 500 gal        | 500 gal            | 800 gal             |
| TankB     | 400 gal        | 300 gal            | 0 gal remaining     |

- `1 WineryOperation` node (`blend`)  
- `2 input relationships` (`WINERY_OP_INPUT`) from TankA and TankB states  
- `1 output relationship` (`WINERY_OP_OUTPUT`) to new TankA state (800 gal)  
- Each `ContainerState` is linked to its `Container` node via `STATE_OF`  

**Relationships:**

- `ContainerState` → `WINERY_OP_INPUT` → `WineryOperation`  
- `WineryOperation` → `WINERY_OP_OUTPUT` → `ContainerState`  
- `ContainerState` → `STATE_OF` → `Container`  

This structure ensures:

- Volume balance can be validated automatically  
- Full lineage reconstruction for audits or time-travel queries  
- Immutable truths: every operation and resulting state is permanent  

## **Collaboration Guidelines**

Grapefruit is designed for **AI-human co-development**.

When collaborating:
- **Reference this README** for all conceptual reasoning.  
- **Preserve invariants** (mathematical balance, lineage continuity, immutability).  
- **Use precise naming** — all abstractions must match terminology defined in *Core Concepts*.  
- **When uncertain, ask or annotate.**  
  - Prefer clarity over assumption.  
  - Ambiguity should be surfaced, not hidden.  
- **Human oversight** is required for merges and schema evolution.

AI contributors should maintain explanatory comments that describe *intent*, not just implementation.

---

## **Current Phase: Ontology & Validation**

Grapefruit is currently in the **ontology validation** phase.  
The goal is to prototype core graph behaviors — containers, states, and operations — to validate the domain model before full application scaffolding.  

App structure, workflows, and UX details will be documented and formalized after this phase, once the conceptual integrity of the graph model has been proven.  

This is deliberate: Grapefruit’s architecture grows *from truth outward*, not from framework inward.

---

## **Roadmap**

- [x] Establish core ontology (containers, states, operations)
- [x] Connect Neo4j via TypeScript driver
- [ ] Add REST API endpoints for container and operation CRUD
- [ ] Implement operation creation logic (transfer, blend, bottle)
- [ ] Add snapshot/time-travel queries
- [ ] Build basic React UI for lineage visualization
- [ ] Implement audit/export tools
- [ ] Integrate with ERP systems (Dynamics 365, Business Central)
- [ ] Define validation rules and permission models

---

## **Future Scope**

While designed for the wine industry, Grapefruit’s model generalizes to any process-based manufacturing domain — from food and beverage to chemical production — wherever traceability, balance, and provenance matter.

By grounding all operations in graph mathematics, Grapefruit provides a flexible and provable foundation for future domains of truth.

---

© 2025 Grapefruit Project. All rights reserved.
