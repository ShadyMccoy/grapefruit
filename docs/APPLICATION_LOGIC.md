# ⚙️ Application Logic Specification

This document describes how Grapefruit's **domain logic**, **repositories**, and **invariants** translate the winery ontology into executable code.  
It is intended for developers and AI collaborators implementing or reasoning about the backend.

---

## 🧩 Architectural Layers

| Layer | Responsibility |
|-------|----------------|
| **Domain Layer** | Defines canonical "truth objects" in TypeScript. Immutable and typed. |
| **Repository Layer** | Provides typed interfaces between domain objects and Neo4j. |
| **Invariants Module** | Enforces runtime integrity before mutations commit. |
| **Service Layer** | Composes repositories, applies invariants, and exposes APIs. |

---

## 🧠 Domain Layer

All entities in Grapefruit are strongly typed interfaces extending `BaseNode`. See `api/src/domain/nodes/` for actual implementations.

Key concepts:
- **Container**: Physical/virtual vessels with type and capacity in h-units
- **ContainerState**: Immutable snapshots with qty, unit, composition (varietals, dual dollars)
- **WineryOperation**: Transformations linking input/output states via relationships

---

## 🗂️ Repository Layer

Repositories abstract Cypher queries behind typed interfaces. See `api/src/db/repositories/` for implementations.

| Repository | Purpose |
|------------|---------|
| ContainerRepo | Container CRUD operations |
| ContainerStateRepo | State management and queries |
| WineryOperationRepo | Operation creation with relationships |

---

## 🔒 Invariants Module

**Status**: Currently commented out during ontology validation. Implementation planned.

When active, will enforce:
- Quantity and nominal dollar conservation
- Single current state per container
- Lineage continuity
- No orphaned operations/states

See `api/src/core/Invariants.ts` for details.

---

## 🔧 Service Layer

Composes repositories for business operations. Ensures invariants are checked before commits.

Key principles:
- Deterministic operations (identical inputs → identical results)
- No randomness or external variance
- TypeScript compile-time safety
- Invariant runtime validation (when implemented)

See `api/src/scripts/` for usage examples.