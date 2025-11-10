# 🍇 Grapefruit

**Grapefruit** provides wineries with **auditable, time-resolved traceability** for every tank, barrel, and bottling — built for seamless ERP integration.

It models the winery as a **directed graph of containers and operations**, where every transformation produces **immutable container states**. This allows the full production history to be reconstructed at any point in time, with **mathematically guaranteed conservation** of volume, composition, and monetary values.

---

## 🧭 Overview

| Concept | Purpose |
|----------|----------|
| **Container** | Physical or virtual vessel (tank, barrel, press, loss, gain). |
| **ContainerState** | Snapshot of a container’s contents at a point in time, including volume and composition. Immutable and versioned. |
| **Operation** | Transformation consuming input states and producing output states (transfer, blend, bottle). |
| **Snapshot** | The reconstructed winery state at a given moment. |
| **Tenant** | Logical owner for multi-winery environments. |

Grapefruit provides a **single source of truth** for material flow, blends, and transformations — forming the foundation for transparent audits, regulatory compliance, and accurate cost accounting.

---

## 🧩 Design Philosophy

1. **Truth** — Model what *actually happened*, not what was planned. Immutable and verifiable.  
2. **Auditability** — Every state and operation can be fully reconstructed.  
3. **Traceability** — Lineage and provenance are inherent in the graph.  
4. **Determinism** — Identical inputs always produce identical outputs.  
5. **Composability** — Complex operations built from smaller primitives.  
6. **Separation of Concerns** — Truth layer, workflow layer, and integration layer remain independent.  
7. **Quantized Precision** — Work in integer h-units (1 h-unit ≈ 1/10,000 gallon) to eliminate floating-point drift while capturing meaningful physical units (grapes).

---

## 🧠 Architecture

- **Backend:** Node.js + TypeScript  
- **Database:** Neo4j 5.x (APOC enabled)  
- **API:** Express REST endpoints  
- **Containerization:** Docker + docker-compose  
- **Frontend (planned):** React for lineage visualization, interactive Sankey/aging diagrams, and heat maps.

> For setup instructions, see [**/docs/SETUP.md**](./docs/SETUP.md)

---

## 🧱 Core Layers

| Layer | Responsibility |
|-------|----------------|
| **Domain Layer** | Typed, immutable “truth objects” (`Container`, `ContainerState`, `Operation`). |
| **Repository Layer** | Typed interface to Neo4j. Encapsulates queries and session handling. |
| **Invariants Module** | Enforces mathematical truths (volume balance, single current state, lineage continuity, composition conservation). |
| **API Layer** | Exposes REST or GraphQL endpoints for integrations and UI. |

This layered structure ensures **compile-time safety** (via TypeScript) and **runtime integrity** (via invariants).

---

## 🧮 The Winery Graph

All operations are modeled as **mixes**:  
`N inputs → M outputs`, where inputs can include **physical containers**, **Gain/Loss containers**, or **LossContainers**.

- **Volume, composition, and nominal dollars are conserved.**  
- **Real dollars** flow only with physical wine.  
- **Gain/Loss** containers capture discrepancies or physical losses.  

Each operation produces new container states and optionally a virtual L node, creating a permanent, auditable record of truth.

---

## 🧩 Documentation Map

| File | Description |
|------|--------------|
| [`docs/GRAPH_MODEL.md`](./docs/GRAPH_MODEL.md) | Ontology and graph structure (nodes, relationships, invariants). |
| [`docs/APPLICATION_LOGIC.md`](./docs/APPLICATION_LOGIC.md) | Domain layer, repository design, and invariants. |
| [`docs/WORKFLOW_MODEL.md`](./docs/WORKFLOW_MODEL.md) | Mapping real-world operations (transfers, blends, bottling) to graph transformations. |
| [`docs/AI_COLLABORATION.md`](./docs/AI_COLLABORATION.md) | Guidelines for AI-assisted code generation and schema reasoning. |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Development roadmap and milestone tracking. |
---

## ⚗️ Current Phase

Grapefruit is in the **ontology validation** phase — proving the integrity of the graph model before expanding into full application workflows.

Once validated, subsequent phases will introduce:
- REST & GraphQL APIs  
- UI for lineage visualization  
- ERP integrations  
- Audit and compliance exports  

## ⏱ Time Model

- Each `ContainerState` has an **absolute timestamp (T)**.  
- Each flow edge has a **delta time (ΔT)** relative to its source state.  
- Containers have a **CURRENT_STATE** pointer to latest containerState  
  - This node’s timestamp = now  
  - ΔT of incoming flows is updated daily  
- This enables **time-weighted integration**, **residence time computation**, and continuous aging visualization.

---

## ⚗️ Visualization & UI Philosophy

- **Mini Sankeys:** Show only containers involved in an operation for teaching the visual language.  
- **Color Coding:** Encode attributes like ABV (alcohol %) as heat maps; brightness can encode age/residence.  
- **Animated Aging Fields:** ΔT allows flows to evolve visually over time.  
- **Composition Tracking:** Shows varietal breakdown and other attributes with deterministic integer arithmetic in h-units.  
- **Interactive Exploration:** Timeline scrubbing and playback of operations, blending, and aging.

---

## ⚖️ License

© 2025 Grapefruit Project. All rights reserved.
