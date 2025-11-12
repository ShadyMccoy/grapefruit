# Grapefruit Domain Model

This folder contains the TypeScript interfaces and types that define Grapefruit's ontology. This document maps **real-world winery operations** to Grapefruit’s **graph and algebra model**.  

It explains how physical and accounting events are represented as mix operations. For the underlying graph structure, see [db/README.md](../db/README.md). For detailed ontology and invariants, see [docs/GRAPH_MODEL.md](../../docs/GRAPH_MODEL.md).

## Key Concepts

# Every Grape Counts

Imagine a winery where every grape and drop of wine is meticulously tracked. Grapefruit's domain model is designed to ensure that all physical quantities and their monetary values are accurately represented and conserved throughout the winemaking process.

---

- **BaseNode**: Common fields for all entities (id, tenantId, createdAt)

- **Container**: Physical or virtual vessels (tank, barrel, press, bottle, loss)

- **Composition**: Varietal percentages and vintages. Any number of quantitative attributes for a container state.

- **ContainerState**: Immutable snapshots with quantity in h-units and composition

- **WineryOperation**: Transformations linking input/output states

- **Relationships**: Flow_to, State_of, etc.

---

## Containers, State, and Composition

# Containers
Containers represent physical or virtual vessels holding wine. Each container has a container type, capacity, location, and other metadata.

# ContainerStates
The containers are linked to immutable ContainerStates that capture the quantity (in h-units) and Composition (varietal percentages, vintages, etc.) at specific points in time.

# h-units
h-units are the standard unit of measurement for physical quantities in Grapefruit. They can represent gallons, liters, or any other volume unit as defined by the winery. They are represented as integers to avoid floating-point precision issues and guarantee accurate accounting. For wine the h-unit typically represents one 1/10,000 of a gallon, which corresponds to less than one grape in real life.

# Composition
Composition defines the breakdown of varietals, origins, appellations, vineyard, and vintage data within a ContainerState. During winery operations the total qty (h-units) must be preserved and the same rule applies to each attribute within the composition. 

---

## Winery Operations

Winery operations are the core transformations that occur within the winery. They include blending, transferring, bottling, and other processes that manipulate the state of containers such as additives or adjustments.

Each operation consumes input ContainerStates and produces output ContainerStates, while adhering to the defined invariants.

Although the client exposes various operation types, internally they are all represented as mix operations that follow the same principles of conservation and traceability as a WineryOperation.

---

## 🔒 Accountability and Invariants

Grapefruit enforces core business rules to maintain system integrity (see [core/Invariants.ts](../core/Invariants.ts) and [core/README.md](../core/README.md)):

- **Volume Conservation**: Total input volume = total output volume
- **Composition Conservation**: for each attribute in the composition, the sum across inputs equals the sum across outputs
- **Lineage Preservation**: All states traceable through immutable operation history

**Note**: Invariants logic is currently commented out pending ontology finalization. Focus on solidifying the domain model first.

# Rounding Considerations

It is critical that the system handles rounding in a way that never violates invariants. Therefore, each operation must implement a deterministic rounding strategy.

### 💰 Dual-Dollar Accounting

Grapefruit enforces mathematically precise conservation of both physical and monetary values as composition attributes.

- **Real dollars**: Track the actual monetary value flowing with physical wine. Affected by losses/evaporation (wine lost = dollars lost) and gains (wine found = dollars gained).
- **Nominal dollars**: Accounting value that must be conserved across all operations, regardless of physical changes. Used for financial reporting and audit trails. Unlike other composition attributes, nominal dollars never flow to or from loss containers.

## 🧠 Virtual Containers

### **Gain/Loss**
- Captures observed discrepancies or small corrections.
- Adds **nominal dollars** but no **real dollars**.
- Treated as a first-class container in the graph.
- Represents physical losses (evaporation, spoilage, spills).
- Reduces **real dollars**, preserves **nominal dollars**.
- Allows negative flows for gains


---

## 🧠 Work Order Flow

1. Operator initiates a work order (transfer, blend, etc.) which is a WineryOperation in draft state.

2. Operation executes:
   - from and to tanks (input states) are physically measured typically as inches within tanks and converted to gallons
   - movement is performed
   - from and to tanks (output states) are physically measured typically as inches within tanks and converted to gallons
   - WineryOperation is updated with actual input/output states and inherent pre-and-post losses and committed.

5. UI reflects new states and historical lineage.

---



## Loss Handling
Winemaking often involves discrepancies between expected and actual quantities due to evaporation, spoilage, or measurement errors. Grapefruit models these discrepancies using loss containers and dual-dollar accounting.

**Real-world**: Accounting for evaporation, spoilage, or gains, errors in measurement.

**Graph Representation**:
- Loss container: Virtual container with type 'loss'
- Negative flows: For gains (wine found)
- Positive flows: For losses (wine evaporated)
- Real dollars adjust with physical changes; nominal dollars conserved

---

## ✅ Outcome

This workflow model ensures:
- Physical actions map directly to graph operations.
- Accounting values remain auditable.
- Gain/Loss containers keep discrepancies explicit.
- All transformations are immutable and traceable.