# Grapefruit Copilot Instructions

## Project Overview
Grapefruit is a **winery traceability system** modeling the cellar as a **directed acyclic graph (DAG)** in Neo4j. Every container transformation produces **immutable states** with **mathematically enforced conservation** of qty, composition, and monetary values.

## Critical Concepts

### Ontology (Truth Layer)
- **Container**: Physical vessel (tank, barrel, press, bottle) or virtual (gain/loss, loss)
- **ContainerState**: Immutable snapshot at timestamp T with qty, composition, real/nominal dollars
- **WineryOperation**: Transformation consuming input states → producing output states
- **FLOW_TO relationships**: Edges between states with ΔT (delta time) and composition

### Dual-Dollar Accounting
- **Real dollars**: Flow only with physical wine (affected by losses/evaporation)
- **Nominal dollars**: Accounting value; must be conserved across all operations
- **Loss containers**: Virtual containers for both gains (negative qtys) and losses (positive qtys); adjust real $ while preserving nominal $ conservation

### Invariants (see `api/src/core/Invariants.ts`)
**Note**: Invariants module exists but logic is currently commented out pending ontology finalization. Focus on getting domain model right first.

## Architecture

```
api/src/
├── domain/          # TypeScript interfaces (Container, ContainerState, WineryOperation)
├── db/repositories/ # Cypher query abstractions (ContainerRepo, ContainerStateRepo)
├── core/            # Invariants enforcement and ValidationResult
└── scripts/         # Seed data and test workflows
```

### Repository Pattern
- All Neo4j access via typed repository classes
- Repositories accept/return domain interfaces, NOT Neo4j objects
- Example: `ContainerRepo.create(container: Container): Promise<void>`

### Domain Types
All entities extend `BaseNode`:
```typescript
interface BaseNode {
  id: string;
  tenantId: string;
  createdAt: Date;
}
```

**Current Cleanup Items**:
- Container type union needs: `"tank" | "barrel" | "press" | "bottle" | "loss"`
- Volume should be integer h-units (1 h-unit = 1/10,000 gallon), not `volumeLiters: number`
- ContainerState needs `realDollars` and `nominalDollars` properties
- Various type definitions in flux during ontology validation phase

## Development Workflow

### Start Environment
```powershell
docker compose up -d  # Starts Neo4j on ports 7474 (browser) and 7687 (bolt)
```

### Seed Database
```powershell
# Load base data (appellations, vineyards, varietals)
Get-Content .\docker-init\01-starter-data.cypher | docker compose exec -T neo4j cypher-shell -u neo4j -p testpassword

# Seed comprehensive test data (containers, states, operations)
cd api
npx tsx src/scripts/seedAll.ts
```

### Run API Server
```powershell
cd api
npm run dev  # ts-node-dev with hot reload
```

### Neo4j Browser Queries
Access http://localhost:7474 (auth: `neo4j/testpassword`)
```cypher
// View operation lineage
MATCH (c:Container)-[:STATE_OF]->(s:ContainerState)<-[:WINERY_OP_OUTPUT]-(op:WineryOperation)
RETURN c, s, op

// Trace container history
MATCH path = (initial:ContainerState)-[:FLOW_TO*]->(current:ContainerState)
WHERE NOT (initial)<-[:FLOW_TO]-()
RETURN path
```

## Coding Conventions

### Naming from Ontology
- Use **exact terminology** from `docs/GRAPH_MODEL.md`: Container, ContainerState, WineryOperation
- Relationship types: `STATE_OF`, `FLOW_TO`, `WINERY_OP_INPUT`, `WINERY_OP_OUTPUT`
- Never abbreviate domain terms (avoid "state" when you mean "ContainerState")

### Determinism Requirement
- **No randomness, timestamps, or environmental variance** in domain logic
- Identical inputs → identical graph results
- Timestamps come from operation metadata, not `Date.now()` in business logic

### Intent Comments
When generating domain/repository code, add intent comments:
```typescript
// Intent: Create ContainerState preserving volume and nominal balance
// Reasoning: Inputs validated; lineage preserved; invariant check required before commit
```

### Type Safety
- All domain objects are strongly typed interfaces
- Cypher queries return plain objects → map to interfaces with `as Container`
- Convert Neo4j DateTime to `Date` when reading: `new Date(c.createdAt)`

### Invariant Enforcement
Before committing any write operation (once implemented):
```typescript
const violations = await invariants.validateOperation(operation);
if (violations.length > 0) {
  throw new InvariantViolationError(violations);
}
```
**Note**: This pattern is planned but not yet enforced. Focus on getting domain model right first.

## Key Files

### Documentation (Read First)
- `docs/GRAPH_MODEL.md` — Ontology, relationships, invariants
- `docs/APPLICATION_LOGIC.md` — Repository pattern, service layer design
- `docs/WORKFLOW_MODEL.md` — Mapping real-world operations (blend, transfer) to graph
- `docs/AI_COLLABORATION.md` — AI-specific guidelines and reasoning hierarchy

### Domain Model
- `api/src/domain/nodes/` — Core entity interfaces
- `api/src/domain/relationships/Movement.ts` — FLOW_TO relationship types

### Database Layer
- `api/src/db/client.ts` — Neo4j driver singleton
- `api/src/db/repositories/` — Typed Cypher query wrappers

### Current Phase
**Ontology validation** — proving graph model integrity before building APIs. Focus on:
- Solidifying domain model (Container types, volume units, dollar tracking)
- Testing operation workflows with scripts
- Cleaning up type inconsistencies ("slop")
- Repository pattern implementation
- Invariants planned but currently commented out

## Common Patterns

### Creating Operations
```typescript
// 1. Fetch current states
const inputStates = await stateRepo.getCurrentStates([containerId1, containerId2]);

// 2. Calculate balanced outputs
const totalVolume = sum(inputStates.map(s => s.volumeLiters));

// 3. Create new state(s)
const newState = await stateRepo.createState({
  containerId: outputContainerId,
  volumeLiters: totalVolume,
  nominalDollars: sum(inputStates.map(s => s.nominalDollars)),
  realDollars: sum(inputStates.map(s => s.realDollars)),
});

// 4. Create operation linking states
const op = await opRepo.createOperation({
  type: 'blend',
  inputs: inputStates,
  outputs: [newState],
});

// 5. Validate invariants
await invariants.validateOperation(op);
```

### Handling Losses
Include Loss container as input with negative volume for gains or positive for losses:
```typescript
const lossContainer = await containerRepo.findByType('loss');
const lossState = await stateRepo.getCurrentState(lossContainer.id);
// Loss containers balance operations: negative volumes = gains, positive = losses
// Real dollars adjust with volume; nominal dollars remain conserved
```

## Anti-Patterns to Avoid
- ❌ Mutating existing ContainerState nodes
- ❌ Creating operations without checking invariants (when implemented)
- ❌ Using floating-point arithmetic for quantities (use integer h-units: 1/10,000 gallon or pound)
- ❌ Introducing non-deterministic logic in repositories
- ❌ Direct Cypher queries outside repositories
- ❌ Assuming current code is final — model in flux, expect "slop" during ontology validation

## 🤖 AI Collaboration Guidelines

Grapefruit is designed for **AI–human co-development**. This section defines how AI agents and human contributors should reason about, modify, and extend the system.

### Purpose
To ensure AI-generated code:
- Preserves **truth invariants**
- Matches **ontology terminology**
- Produces **explainable, auditable** reasoning and code

### Reasoning Hierarchy
When generating or editing code, AI agents should reason in this order:

1. **Graph Ontology** → (`docs/GRAPH_MODEL.md`)
2. **Domain & Repositories** → (`docs/APPLICATION_LOGIC.md`)
3. **Workflow Semantics** → (`docs/WORKFLOW_MODEL.md`)
4. **Integration Logic** → API, ERP interfaces
5. **Infrastructure** → Docker, environment, CI/CD

Never modify code without checking alignment with these documents.

### Coding Guidelines
- Use **precise naming** from the ontology (Container, ContainerState, WineryOperation)
- Always **explain intent** in comments — not just implementation
- When uncertain, **ask or annotate** assumptions clearly
- Do not introduce randomness, timestamps, or environmental variance
- Maintain **determinism** across all generated functions
- Use h-units for quantities (integer precision)
- Include dual-dollar accounting in compositions

### Commenting Convention
```ts
// Intent: Create new ContainerState preserving qty and nominal balance
// Reasoning: Inputs validated; lineage preserved; invariant check planned but not yet enforced
```

AI collaborators must leave these "intent" comments for human reviewers.

### Human Oversight
All schema or ontology changes require human review and approval.

AI may propose modifications but must flag them as `// Suggestion:` or `// Requires review:`.

Merge actions should only occur after validation of balance and lineage logic.

### Example: Good AI Contribution
```ts
// Intent: Implement Loss container adjustment during blend operations
// Suggestion: Include loss container in operation inputs for evaporation tracking
// Requires review: Verify loss handling logic aligns with dual-dollar accounting

const lossContainer = await ContainerRepo.findByType('loss');
const lossState = await ContainerStateRepo.findById(lossContainer.id); // Current loss state
const opId = await WineryOperationRepo.createOperation(
  { id: 'blendOp', tenantId: 'winery1', createdAt: new Date(), type: 'blend', description: 'Blend with loss adjustment' },
  ['inputState1', 'inputState2', lossState.id], // Include loss as input
  [{ containerId: 'outputTank', stateId: 'newState', qty: 195, unit: 'gal', composition: { realDollars: 950, nominalDollars: 1000 } }], // Adjusted for 5 gal loss
  [] // flows
);
```

### Goal
AI collaboration in Grapefruit should amplify precision, not creativity. Every contribution must strengthen auditability.
