# 🍇 Grapefruit

**Grapefruit** gives wineries **auditable, time-traveling traceability** for every tank, barrel, and bottling — built for seamless ERP integration.

It models the winery as a **directed graph of containers and operations**, where every transformation creates new immutable container states.  
This allows the full production history to be reconstructed at any point in time — with **mathematically guaranteed balance** between what goes in and what comes out.

---

## 🧭 Overview

| Concept | Purpose |
|----------|----------|
| **Container** | Physical or virtual vessel (tank, barrel, press, loss, gain). |
| **State** | Snapshot of a container’s contents at a point in time. |
| **Operation** | Transformation that consumes and produces states (transfer, blend, bottle). |
| **Snapshot** | The reconstructed winery state at a given moment. |
| **Tenant** | Logical owner for multi-winery environments. |

Grapefruit provides a **single source of truth** for material flow, blends, and transformations — forming the foundation for transparent audits, regulatory compliance, and accurate cost accounting.

---

## 🧩 Design Philosophy

1. **Truth** — Model what *actually happened*, not what was planned. Immutable and verifiable.
2. **Auditability** — Every state and operation must be explainable and reconstructable.
3. **Traceability** — Lineage and provenance are inherent in the graph.
4. **Determinism** — Identical inputs always produce identical outputs.
5. **Composability** — Complex operations built from smaller primitives.
6. **Separation of Concerns** — Truth layer, workflow layer, and integration layer remain independent.

---

## 🧠 Architecture

- **Backend:** Node.js + TypeScript  
- **Database:** Neo4j 5.x (APOC enabled)  
- **API:** Express REST endpoints  
- **Containerization:** Docker + docker-compose  
- **Frontend (planned):** React for lineage visualization  

> For setup instructions, see [**SETUP.md**](./SETUP.md)

---

## 🧱 Core Layers

| Layer | Responsibility |
|-------|----------------|
| **Domain Layer** | Typed, immutable “truth objects” (`Container`, `ContainerState`, `Operation`). |
| **Repository Layer** | Typed interface to Neo4j. Encapsulates queries and session handling. |
| **Invariants Module** | Enforces mathematical truths (volume balance, single current state, lineage continuity). |
| **API Layer** | Exposes REST or GraphQL endpoints for integrations and UI. |

This layered structure ensures **compile-time safety** (via TypeScript) and **runtime integrity** (via invariants).

---

## 🧮 The Winery Graph

All operations are modeled as **mixes**:  
`N inputs → M outputs`, where inputs can include **physical containers**, **Gain/Loss containers**, or **LossContainers**.

- **Volume and nominal dollars** are conserved.  
- **Real dollars** flow only with physical wine.  
- **Gain/Loss** and **LossContainers** capture discrepancies or physical losses.  

Each operation produces new container states — creating a permanent, auditable record of truth.

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

---

## ⚖️ License

© 2025 Grapefruit Project. All rights reserved.
