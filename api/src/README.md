# ⚙️ Application Logic Specification

---

## 🧩 Architectural Layers

| Layer | Responsibility |
|-------|----------------|
| **DB Layer** | Provides typed interfaces between domain objects and the graph db (Neo4j). See [db/README.md](db/README.md). |
| **Domain Layer** | Defines abstract objects representing winery operations for the **internal** app logic. See [domain/README.md](domain/README.md). |
| **Service Layer** | Helpful utilities for interacting with the domain layer representing the **external** mental model. Includes core invariants and validation. See [core/README.md](core/README.md). |
| **Client Layer** | front-end UX for consuming service tier functions |

---

---

## 🧠 Domain Layer

All entities in Grapefruit are strongly typed interfaces.

Key concepts:
- **Container**: Physical/virtual vessels with type and capacity
- **ContainerState**: Immutable snapshot of a container with qty and composition (varietals, vintage, value, etc.)
- **WineryOperation**: Transformations linking input/output states via flow relationships

---

# Service Layer

- top-level module entrypoints and thin wiring that composes domain logic (`core/`), persistence (`db/`), and developer scripts (`scripts/`).

- `index.ts` publically exposes the main services of the API:

| Service | Description | Contents | 
| Containers | CRUD operations for managing physical and virtual containers in the winery. | the container header node and the current state |
| Container States | Immutable snapshots of a container's contents at a point in time. | Quantity, composition, timestamps |
| Compositions | Manage the composition of contents within a container state. | Varietals, vintage, percentages |
| Winery Operations | Every action which is transforming a container state is recorded as a winery operation. | From and To container states, flow quantities, gain/loss |
| Weigh Tags | Interface for recording weigh tag data associated with container states. | Qty, timestamps, id, linked operations |

# Client Layer

Not yet defined. Focus on helpful and visual representation of winery data and operations.

