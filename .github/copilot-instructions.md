---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: GrapefruitAgent
description: Winery traceability system with Neo4j graph model for immutable state conservation
---

# Grapefruit Copilot Instructions

## Project Overview
Grapefruit is a winery traceability system using Neo4j to model the cellar as a DAG. Every transformation creates immutable ContainerStates with enforced conservation of quantity, composition, and dollars.

## Critical Concepts
- **Ontology**: Container, ContainerState (immutable qty/composition snapshot), WineryOperation (mix: N inputs → M outputs).
- **Dual-Dollar Accounting**: Real dollars follow physical wine; nominal dollars always conserved.
- **Invariants**: Qty, composition, lineage enforced in WineryOperationService.validateAndCommitOperation().
- **H-Units**: Integer precision (1/10,000 gallon) using bigint to avoid floating-point issues.

## Architecture
- **Domain Layer** (`api/src/domain/`): TypeScript interfaces for Container, ContainerState, WineryOperation.
- **Repository Layer** (`api/src/db/repositories/`): Cypher abstractions returning typed domain objects.
- **Core Layer** (`api/src/core/`): Invariants, composition algebra, operation validation.
- **Scripts** (`api/src/scripts/`): Seeding and testing workflows.

## Development Workflow
- Start: `docker compose up -d` (Neo4j at localhost:7474, neo4j/testpassword)
- Seed: `cd api; npx tsx src/scripts/seedAll.ts`
- Run: `cd api; npm run dev` (hot reload)
- Test: `cd api; npx tsx src/scripts/testCypher.ts` or `verifySeeding.ts`
- Query: Use Neo4j Browser for graph visualization.

## Coding Conventions
- **Naming**: Exact ontology terms (Container, not Tank); no abbreviations.
- **Determinism**: No randomness/timestamps in domain logic.
- **Intent Comments**: `// Intent: ... // Reasoning: ...` for complex logic.
- **Type Safety**: Strongly typed domain objects; map Neo4j results to interfaces.
- **Repository Pattern**: All DB access via repos; use Cypher with parameters.
- **Quantities**: Use bigint for h-units; avoid floating-point.
- **Operations**: All as mixes with delta-based flows summing to zero.

## Key Files
- `ROADMAP.md`: Development phases.
- `SETUP.md`: Environment setup.
- `api/src/domain/README.md`: Ontology and operations.
- `api/src/db/README.md`: Graph structure.
- `api/src/core/README.md`: Invariants and algebra.

## AI Collaboration Guidelines
- Reason hierarchically: Ontology → Domain/Repos → Workflow → Integration.
- Preserve invariants and auditability.
- Flag ontology changes for review.
- Use precise terminology from docs.