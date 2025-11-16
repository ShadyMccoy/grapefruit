---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: HelloGithubAgent
description: Basic project instructions for ai collaboration
---

# Grapefruit Copilot Instructions

## Project Overview
Grapefruit is a winery traceability system modeling the cellar as a directed acyclic graph (DAG) in Neo4j. Every container transformation produces immutable states with mathematically enforced conservation of qty, composition, and monetary values.

## Critical Concepts
- **Ontology**: Container (tank/barrel/bottle/loss), ContainerState (immutable snapshot with qty/composition), WineryOperation (transformation).
- **Dual-Dollar Accounting**: Real dollars flow with physical wine; nominal dollars conserved for accounting.
- **Mental Model**: Operations as mixes (N inputs → M outputs) with delta-based conservation—net flows from each input state sum to zero for qty, composition, and dollars.
- **Invariants**: Enforced in `WineryOperationService.validateAndCommitOperation()` for qty, composition, lineage, and dollar balance.
- **H-Units**: Integer precision (1/10,000 gallon) to avoid floating-point drift.

## Architecture
```
api/src/
├── domain/          # TypeScript interfaces (Container, ContainerState, WineryOperation)
├── db/repositories/ # Cypher query abstractions (ContainerRepo, etc.)
├── core/            # Invariants enforcement and ValidationResult
└── scripts/         # Seed data and test workflows
```

## Development Workflow
- **Start Environment**: `docker compose up -d` (Neo4j on 7474/7687)
- **Seed Database**: `cd api; npx tsx src/scripts/seedAll.ts`
- **Run API Server**: `cd api; npm run dev` (ts-node-dev hot reload)
- **Neo4j Browser**: http://localhost:7474 (neo4j/testpassword)

## Coding Conventions
- **Naming**: Use exact ontology terms (Container, ContainerState, WineryOperation); no abbreviations.
- **Determinism**: No randomness/timestamps in domain logic; identical inputs → identical outputs.
- **Intent Comments**: Add `// Intent: ... // Reasoning: ...` for domain/repo code.
- **Type Safety**: All domain objects strongly typed; map Neo4j results to interfaces.
- **Repository Pattern**: All Neo4j access via typed repos returning domain interfaces.

## Key Files
- `ROADMAP.md` — Development phases
- `api/src/domain/README.md` — Domain model details
- `api/src/db/README.md` — Graph structure and relationships
- `api/src/core/README.md` — Invariants and operation algebra
- `SETUP.md` — Environment setup

## AI Collaboration Guidelines
- Reason in hierarchy: Ontology → Domain & Repositories → Workflow Semantics → Integration
- Preserve truth invariants and auditability
- Flag schema/ontology changes for human review
- Use precise terminology from docs