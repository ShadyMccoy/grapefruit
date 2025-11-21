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
Grapefruit is a winery traceability system using Neo4j to model the cellar as a DAG. Every transformation creates immutable `ContainerState` nodes with enforced conservation of quantity, composition, and dollars.

## Critical Concepts
- **Ontology**: 
  - `Container`: Physical vessel (Tank, Barrel).
  - `ContainerState`: Immutable snapshot of a container at a specific time (qty + composition).
  - `WineryOperation`: A transformation (mix) taking N input states and producing N output states.
- **H-Units**: All quantities are `bigint` integers representing 1/10,000th of a unit (gal, lbs). **NEVER use floating point math.**
- **Dual-Dollar Accounting**: 
  - `realDollars`: Tracks actual cost. Lost during operational losses (evaporation) and "gained" when wine is found.
  - `nominalDollars`: Tracks accounting value. Always conserved.
- **Invariants**: Enforced by `WineryOperationService.validateAndCommitOperation()` via `Invariants.ts`:
  1. **Single Current State**: A container must have exactly one current state.
  2. **Input Currency**: Input states must be current (no outgoing flows).
  3. **Conservation**: 
     - **Input Side**: Sum of outgoing flows from an input state must equal its quantity.
     - **Output Side**: Sum of incoming flows to an output state must equal its quantity.
  4. **Positive Flows**: All flows must be positive. Losses flow to a LossNode; Gains flow from a GainNode.
- **Operation Pattern**: All containers involved in an operation (source OR destination) must be included in `fromContainers`. Destination containers simply have their current state (even if empty) passed as an input.

## Architecture
- **Domain Layer** (`api/src/domain/`): Pure TypeScript interfaces. The "Truth" objects.
- **Core Layer** (`api/src/core/`): Business logic.
  - `WineryOperationService.ts`: Entry point for state changes.
  - `CompositionHelpers.ts`: Integer math for blending/distributing (Largest Remainder Method).
- **Repository Layer** (`api/src/db/repositories/`): Cypher abstractions. Returns typed domain objects.
- **Scripts** (`api/src/scripts/`): **Primary testing and execution mechanism.**

## Development Workflow
- **Start DB**: `docker compose up -d` (Neo4j at localhost:7474, user: `neo4j`, pass: `testpassword`)
- **Seed Data**: `cd api; npx tsx src/scripts/seedAll.ts`
- **Run Server**: `cd api; npm run dev`
- **Run Tests**: `cd api; npx tsx src/scripts/flowHarness.ts` (or `npm test`)
  - *Note*: Tests are script-based scenarios. See `api/src/scripts/testTransfer.ts` for a simple example.
- **Verify DB**: `cd api; npx tsx src/scripts/verifySeeding.ts`

## Coding Conventions
- **Naming**: Use exact ontology terms (`Container`, `ContainerState`). Do not abbreviate.
- **Comments**: Use `// Intent: ...` and `// Reasoning: ...` for complex logic blocks.
- **Determinism**: Domain logic must be pure and deterministic. No `Date.now()` or `Math.random()` inside core logic.
- **Type Safety**: Strictly map Neo4j results to Domain interfaces.
- **BigInt**: Use `n` suffix for literals (e.g., `10000n`).

## Key Files
- `api/src/core/WineryOperationService.ts`: The "brain" of the operation logic.
- `api/src/scripts/flowHarness.ts`: The testing framework.
- `api/src/domain/nodes/QuantifiedComposition.ts`: Definition of the H-Unit structure.
- `api/src/core/Invariants.ts`: The rules that must never be broken.

## AI Collaboration Guidelines
- **Reason Hierarchically**: Ontology -> Domain/Repos -> Workflow -> Integration.
- **Preserve Invariants**: Never suggest code that bypasses `validateAndCommitOperation` for state changes.
- **Test via Scripts**: When asked to write a test, create a new script in `api/src/scripts/` or add a scenario to `flowHarness.ts`.
- **Integer Math**: Always use `CompositionHelpers` for math. Never manually divide/multiply compositions if avoidable.