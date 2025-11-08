# ⚙️ Application Logic Specification

This document describes how Grapefruit’s **domain logic**, **repositories**, and **invariants** translate the winery ontology into executable code.  
It is intended for developers and AI collaborators implementing or reasoning about the backend.

---

## 🧩 Architectural Layers

| Layer | Responsibility |
|-------|----------------|
| **Domain Layer** | Defines canonical “truth objects” in TypeScript. Immutable and typed. |
| **Repository Layer** | Provides typed interfaces between domain objects and Neo4j. |
| **Invariants Module** | Enforces runtime integrity before mutations commit. |
| **Service Layer** | Composes repositories, applies invariants, and exposes APIs. |

---

## 🧠 Domain Layer

All entities in Grapefruit are strongly typed interfaces.

### Example Interfaces

```ts
interface BaseNode {
  id: string;
  tenantId: string;
  createdAt: Date;
}

interface Container extends BaseNode {
  name: string;
  type: 'tank' | 'barrel' | 'press' | 'gainLoss' | 'loss';
  capacity: number;
}

interface ContainerState extends BaseNode {
  containerId: string;
  volume: number;
  nominalDollars: number;
  realDollars: number;
  predecessorId?: string;
}

interface Operation extends BaseNode {
  type: 'transfer' | 'blend' | 'bottle' | 'adjustment';
  operator?: string;
  workOrderId?: string;
  metadata?: Record<string, any>;
}
```

### Repository Layer

Repositories abstract Cypher queries behind typed interfaces.

Repository	Key Functions
ContainerRepo	create(), findById(), listByTenant()
ContainerStateRepo	createState(), getCurrentState(), findHistory()
OperationRepo	createOperation(), findById(), listByType()

Example snippet:

const op = await OperationRepo.createOperation({
  type: 'blend',
  inputs: [stateA, stateB],
  outputs: [newState],
});

## Invariants Module

Before committing any write, invariants are enforced.

Core Checks

BalanceInvariant — Volume and nominal dollars conserved.

LineageInvariant — Each state has one predecessor.

UniquenessInvariant — One current state per container.

IntegrityInvariant — No orphaned operations or states.

Violations should throw typed errors (e.g., InvariantViolationError).

## Service Layer Example

Pseudocode for a simple blend operation:

```
async function performBlend(inputs: string[], outputContainerId: string) {
  const inputStates = await stateRepo.getCurrentStates(inputs);
  const totalVolume = sum(inputStates.map(s => s.volume));
  const totalNominal = sum(inputStates.map(s => s.nominalDollars));
  const totalReal = sum(inputStates.map(s => s.realDollars));

  const newState = await stateRepo.createState({
    containerId: outputContainerId,
    volume: totalVolume,
    nominalDollars: totalNominal,
    realDollars: totalReal,
    predecessorId: null,
  });

  const op = await opRepo.createOperation({
    type: 'blend',
    inputs: inputStates,
    outputs: [newState],
  });

  await Invariants.checkBalance(op);
  return op;
}
```

### Type Safety and Determinism

All operations are deterministic given identical inputs.

Randomness, timestamps, and external context never alter graph results.

TypeScript ensures compile-time correctness; invariants ensure runtime truth.

### Goal

This layer guarantees that application logic never violates truth —
Neo4j is simply a persistence engine for the mathematically balanced domain.