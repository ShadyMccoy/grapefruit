Executive Summary

This project introduces a next-generation architecture for modeling material transformations — starting with the wine industry as a real-world proving ground. The system treats every movement, blend, and loss as part of a mathematically balanced transaction graph. Instead of storing static records, it models how physical reality evolves through time, ensuring total traceability, correctness, and auditability.

At its core, the model has one job: to represent state transitions and conserve quantity. It remains logically pure — free from business logic, workflows, or regional regulations. These are built as layers around the core, keeping the foundation minimal, universal, and trustworthy. This purity allows the system to scale, adapt to international wineries, and later apply to other industries with similar flow dynamics — from food to chemicals to energy.

By anchoring the concept in winemaking, a domain with natural complexity, regulatory depth, and constant transformation under served by existing solutions the app is focused on a specific use case.

Business Concept

The platform tracks how wine moves, transforms, and blends across thousands of containers — tanks, barrels, presses, or bottling lines — while guaranteeing mathematical balance at every step. Each operation creates new container states derived from prior ones, forming a directed acyclic graph (DAG) that mirrors the real, physical flow of wine.

Core Architecture

Container State Model:
Each container has evolving “states,” each linked to its predecessors through transactions. These states hold references to both origin and output nodes, preserving full material lineage.

Movements as First-Class Nodes:
Every transfer, blend, or press operation is its own node, with input and output relationships carrying quantities (gallons, pounds, etc.), gains, and losses. The model ensures total conservation across every transaction.

Recursive Provenance:
Container states can reference both raw “leaf” origins (like weigh tags) and other container states, allowing recursive aggregation without redundant data. Periodic repacking keeps it efficient.

Snapshots and Time Travel:
Snapshots exist as nodes referencing all container states at a given moment. They allow instant time-travel, efficient lookups, and reconstruction of any prior operational state.

Client-Side Validation:
Transactions reference the specific base state they modify. The client computes the resulting attributes locally; the server simply validates that the base state is current and fast-forwards the change. If not, it rejects the transaction — ensuring concurrency safety with minimal overhead.

Performance and Scalability

Efficient handling of large barrel groups or distributed containers without synthetic grouping.

Periodic repacking of highly recursive state graphs for compactness.

Lookup tables for active container states support fast operational queries.

Design Philosophy

Purity of Role: The model does one job — represent truth.

Mathematical Certainty: Conservation enforced at the data level, not the business layer.

Layered Logic: Business rules, compliance, and workflows live outside the model.

Visual Intuition: A graph-based visualization (e.g., Sankey-inspired) turns complex lineage into clarity — enhancing comprehension, traceability, and error detection.

Universality: The wine use case validates the framework, but the model generalizes to any domain where material flows and transforms.

Outcome

The result is a system that “just works.”
No whack-a-mole bugs from tangled logic.
No sluggish reporting from massive joins.
Just a clean, auditable, high-speed representation of physical truth — ready to scale with the next generation of intelligent process management all on its own.


# Grapefruit — Material Flow Modeling Pretotype Phase

## Current Goals

- Validate architecture for a **graph-based, transaction-first material flow system**.  
- Establish a working Node/TypeScript + Neo4j stack in Docker.  
- Confirm API → Neo4j connectivity and basic data modeling capability.  

---

## Tech Stack Decisions

| Layer | Technology / Approach | Status |
|-------|--------------------|--------|
| Backend / Business Tier | Node.js + TypeScript | ✅ Working |
| API Layer | Express, REST endpoints | ✅ Working |
| Graph Database | Neo4j 5.x | ✅ Running in Docker |
| Infrastructure | Docker + Docker Compose, single network for API + Neo4j | ✅ Working |
| CI/CD | TBD (future, after architecture validation) | ⬜ Planned |
| Frontend / UI | Skipped for pretotype | ⬜ Planned |
| Observability / Logs | Skipped for pretotype | ⬜ Planned |
| Data Lifecycle / Repacking | Minimal setup via Neo4j volumes | ✅ Partially setup |
| Background Jobs | Excluded for pretotype | ⬜ Planned |
| Monitoring / Metrics | Deferred; removed unsupported Neo4j Prometheus settings | ⬜ Planned |

---

## Docker Setup

- **API container**: Node/TypeScript, volume-mapped for live reload via `ts-node-dev`.  
- **Neo4j container**: Runs 5.x, includes APOC plugin.  
- **Network**: `grapefruit-net` connects API and database.  
- **Volumes**: Persistent data/logs/backups under `./db`.  

**Commands:**

```bash
# Start / restart stack
docker compose up

# Stop and remove containers + volumes
docker compose down -v

# Rebuild API container
docker compose build api
