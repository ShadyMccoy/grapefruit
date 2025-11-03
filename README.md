# Grapefruit — Material Flow Modeling Pretotype Phase

## Executive Summary

This project introduces a next-generation architecture for modeling material transformations — starting with the wine industry as a real-world proving ground. The system treats every movement, blend, and loss as part of a mathematically balanced transaction graph. Instead of storing static records, it models how physical reality evolves through time, ensuring total traceability, correctness, and auditability.

At its core, the model has one job: to represent state transitions and conserve quantity. It remains logically pure — free from business logic, workflows, or regional regulations. These are built as layers around the core, keeping the foundation minimal, universal, and trustworthy. This purity allows the system to scale, adapt to international wineries, and later apply to other industries with similar flow dynamics — from food to chemicals to energy.

By anchoring the concept in winemaking, a domain with natural complexity, regulatory depth, and constant transformation underserved by existing solutions, the app is focused on a specific use case.

---

## Business Concept

The platform tracks how wine moves, transforms, and blends across thousands of containers — tanks, barrels, presses, or bottling lines — while guaranteeing mathematical balance at every step. Each operation creates new container states derived from prior ones, forming a directed acyclic graph (DAG) that mirrors the real, physical flow of wine.

---

## Core Architecture

### Container State Model
- Each container has evolving “states,” each linked to its predecessors through transactions.
- States hold references to both origin and output nodes, preserving full material lineage.

### Movements as First-Class Nodes
- Every transfer, blend, or press operation is its own node.
- Input and output relationships carry quantities (gallons, pounds, etc.), gains, and losses.
- The model enforces total conservation across every transaction.

### Recursive Provenance
- Container states reference both raw “leaf” origins (like weigh tags) and other container states.
- Recursive aggregation avoids redundant data.
- Periodic repacking keeps state graphs compact.

### Snapshots and Time Travel
- Snapshots capture all container states at a given moment.
- They allow instant time-travel, efficient lookups, and reconstruction of prior operational states.

### Client-Side Validation
- Transactions reference the specific base state they modify.
- Clients compute resulting attributes locally; the server validates the base state and fast-forwards the change.
- Ensures concurrency safety with minimal overhead.

---

## Performance and Scalability

- Efficient handling of large barrel groups or distributed containers without synthetic grouping.
- Periodic repacking of highly recursive state graphs for compactness.
- Lookup tables for active container states enable fast operational queries.

---

## Design Philosophy

- **Purity of Role:** The model does one job — represent truth.
- **Mathematical Certainty:** Conservation enforced at the data level, not the business layer.
- **Layered Logic:** Business rules, compliance, and workflows live outside the model.
- **Visual Intuition:** Graph-based visualizations (e.g., Sankey-inspired) simplify complex lineage, enhancing traceability and error detection.
- **Universality:** Wine use case validates the framework; the model generalizes to other domains with similar material flows.
- **Thin Clients First:** Most logic resides in the API/graph layer; clients remain light.
- **UX First:** Interactive Sankey pruning sliders, cellar maps showing physical tank positions, and color-coded feedback are preferred over heavy frontend computation, reinforcing the “it just works” philosophy.

---

## Current Goals (Pretotype Phase)

- Validate architecture for a **graph-based, transaction-first material flow system**.  
- Establish a working Node/TypeScript + Neo4j stack in Docker.  
- Confirm API → Neo4j connectivity and basic data modeling capability.  
- Use README as a **meta-prompt** for AI-assisted development.

> **Note:** Focus is on architecture validation — no full frontend or background jobs yet. React-based UI discussion is exploratory and informs design philosophy.

---

## Tech Stack Decisions

| Layer | Technology / Approach | Status |
|-------|--------------------|--------|
| Backend / Business Tier | Node.js + TypeScript | ✅ Working |
| API Layer | Express REST endpoints | ✅ Working |
| Graph Database | Neo4j 5.x + APOC plugin | ✅ Running in Docker |
| Infrastructure | Docker + Docker Compose, single network | ✅ Working |
| CI/CD | TBD (post-architecture validation) | ⬜ Planned |
| Frontend / UI | React explored, thin-client philosophy | ⬜ Planned |
| Observability / Logs | Skipped for pretotype | ⬜ Planned |
| Data Lifecycle / Repacking | Minimal setup via Neo4j volumes | ✅ Partially setup |
| Background Jobs | Excluded for pretotype | ⬜ Planned |
| Monitoring / Metrics | Deferred; removed unsupported Neo4j Prometheus settings | ⬜ Planned |
| Auth / Billing | Clerk.dev + Stripe integration | ⬜ Planned |

---

## Users / Auth & Billing

### Authentication / Session Management

- **Provider:** Clerk.dev (or similar OAuth/OIDC provider).  
- **Flow:**
  1. Client logs in via Clerk, obtains JWT token.  
  2. Token sent with API requests in `Authorization: Bearer <token>`.  
  3. API verifies token validity; optionally caches verification for short TTL.  
  4. Server uses token payload (e.g., `tenantId`) to scope queries.  

- **Tenant Isolation:** 
  - Each tenant has a `Tenant` node; all container states, operations, programs, and lab results link to it.  
  - Queries traverse tenant relationships for security and multi-tenancy.  

- **Admin / Management:**
  - Admins view all tenant data in scope.  
  - Audit nodes maintain traceability of corrections beyond reporting periods.  

### Billing / Stripe Integration

- **Stripe integration approach:**
  - Server verifies subscription via Stripe before allowing feature access.  
  - Each tenant’s subscription is linked to its tenant node.  
  - Webhooks handle subscription events (start, cancel, renewal) and update tenant access.  

- **Use Cases:**
  - Free-tier vs. paid-tier feature gating.  
  - Tracking container counts or usage for billing metrics.  
  - Optional Stripe customer ID stored on tenant node.  

- **Architecture Fit:** Auth and billing logic live outside the core transaction graph. API mediates access without polluting the data model.

---

## Graph Data Modeling Highlights

- **Lab Data Nodes:** Alcohol %, temperature, and other metrics as nodes linked to container states; aggregation for lineage calculations.  
- **Program / Allocation Nodes:** Track container allocations to multiple programs and their progress toward goals.  
- **Vocabulary Nodes:** Categorical data (varietal, location, etc.) as nodes, extensible per tenant.  
- **Lineage Queries:** Recursive traversals (Container → Operation → Container states) using APOC for pruning and aggregation.  
- **Tenant Nodes:** Better than relying solely on tenant ID properties; isolates data per client.

---

## Frontend / UX Considerations

- **Routing:** Client-side routing via React Router with query params for container/program selection.  
- **Caching:** Thin client caches recent API responses.  
- **State Management:** Local state or lightweight stores (e.g., Zustand, React Context).  
- **Visualizations:** Sankey diagrams with slider pruning, cellar maps for tank positions.  
- **UX Philosophy:** Previews for downstream effects before committing data; color-coded lineage errors for immediate feedback.  

---

## AI-Accelerated Development

- README doubles as **living meta-prompt** for AI-assisted development.  
- Cypher snippets, API scaffolding, and TypeScript classes can be generated using README content.  
- Continuous updates improve future AI suggestions and prototyping speed.

---

## Next Steps (Roadmap)

1. Complete **Phase 1 pretotype** — core container state + operations graph.  
2. Build **Phase 2 operations layer** — minimal API endpoints for CRUD operations.  
3. Develop **sample queries / visualizations** for Sankey diagrams and cellar maps.  
4. Integrate **AI-assisted development loop** for generating Cypher, API endpoints, and test scaffolding.  
5. Begin planning **Phase 3 — React UI layer** once API and data model are stable.  

---

## Next Steps (Current Pretotype Phase)

1. Lay out **weekly sprints** to organize milestones and track architecture validation.  
2. Break each weekly sprint into **daily dev tasks**, sized 30–60 minutes for rapid iteration and progress tracking.  
3. Continue building **Phase 1 core engine**:  
   - Container state model  
   - Basic operations (transfer, blend, fill, drain, packaging)  
   - Graph validations and recursive lineage queries  
4. Confirm **API ↔ Neo4j connectivity** and query performance with synthetic data.  
5. Document **observations, pitfalls, and design decisions** in the README for AI-assisted development.  
6. Begin **Phase 2 planning** for minimal operations layer / UI templates.  

---

## Notes & Philosophy

- Focus on **validating architecture** first.  
- Maintain **traceability, auditability, and correctness** as first-class principles.  
- Keep clients **thin**; backend handles most logic.  
- Visualizations and dashboards improve clarity, prevent errors, and reinforce the “it just works” philosophy.

---

## Docker Setup

- **API container:** Node/TypeScript, volume-mapped for live reload via `ts-node-dev`.  
- **Neo4j container:** Runs 5.x, includes APOC plugin.  
- **Network:** `grapefruit-net` connects API and database.  
- **Volumes:** Persistent data/logs/backups under `./db`.

**Commands:**

```bash
# Start / restart stack
docker compose up

# Stop and remove containers + volumes
docker compose down -v

# Rebuild API container
docker compose build api
