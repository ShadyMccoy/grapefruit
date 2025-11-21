# 🔧 Core Layer: Invariants & Validation

The core layer implements Grapefruit's business rules and mathematical integrity. It provides utilities for composition calculations, invariant validation, and operation algebra—ensuring conservation of quantities, dollars, and lineage across winery transformations.

This layer sits between the domain (abstract models, see [domain/README.md](../domain/README.md)) and DB (persistence, see [db/README.md](../db/README.md)), turning business concepts into concrete numerical representations.

## ⚠️ Design Principle: Fragility & Strictness

The Core layer is designed to be **fragile**. It assumes that the upstream data and logic are correct.
- **No Auto-Correction**: If an invariant is violated (e.g., mass balance off by 1 unit), the operation **fails**. It does not attempt to round or fuzz the numbers.
- **No Defensive Reads**: It assumes the database state is valid (e.g., a container has exactly one current state). If the DB returns multiple "current" states, the system throws an error rather than picking one arbitrarily.
- **Fail Fast**: The goal is to surface bugs immediately during testing (via `scripts/`) rather than masking them with "robust" error handling that leads to silent data corruption.

---

## 🔒 Invariants

The `Invariants` class enforces critical business rules before operations are committed to the database. All invariants use a delta-based flow model where net flows from each input state must sum to zero.

### Implemented Invariants

#### 1. Single Current State per Container
**Method**: `assertSingleCurrentState(containerId: string)`  
**Purpose**: Ensures each container has exactly one CURRENT_STATE pointer  
**Why**: Prevents timeline ambiguity and data corruption

#### 2. Input States Must Be Current
**Method**: `assertInputStatesAreCurrent(inputStateIds: string[])`  
**Purpose**: Validates all input states have no outgoing FLOW_TO relationships  
**Why**: Operations should only consume head states, not historical intermediates

#### 3. Quantity Conservation
**Method**: `assertQuantityConservation(operation: WineryOperation)`  
**Purpose**: Validates net flows from each input sum to zero (delta model)  
**Why**: Ensures physical quantities are balanced across transformations

#### 4. Composition Conservation
**Method**: `assertCompositionConservation(operation: WineryOperation)`  
**Purpose**: Validates varietals and dollar deltas net to zero for each input  
**Why**: Ensures composition attributes are properly distributed

#### 5. Nominal Dollar Conservation
**Method**: `assertNominalDollarConservation(operation: WineryOperation)`  
**Purpose**: Validates nominal dollars balance across entire operation  
**Why**: Critical for accounting integrity; nominal dollars must ALWAYS balance

#### 6. Valid Flow Indices
**Method**: `assertValidFlowIndices(operation: WineryOperation)`  
**Purpose**: Validates flow from/to indices are within bounds  
**Why**: Prevents index out-of-bounds errors when creating relationships

### Batch Validation

**Method**: `validateOperation(operation: WineryOperation)`  
Runs all invariant checks and returns only violations. Used by `WineryOperationService.createOperation()` to validate before database commit.

### Removed Invariants

- **`assertSinglePredecessor`**: Removed because blend operations create states with multiple incoming FLOW_TO relationships from different containers, which is valid and expected behavior.
- **`assertVolumeBalance`**: Replaced with `assertQuantityConservation` using correct property names and delta model.

---

## Operation Algebra
### Basic Operation Structure
Each WineryOperation transforms input ContainerStates into output ContainerStates. To reason about these transformations, we define the following components and shorthand notations:

- **Operations**: "O" 
- **Inputs**: Current states of source containers "A" and "B" (e.g., A(0), B(0))
- **Outputs**: New states for destination containers (e.g., A(1), B(1))
- **Flows**: FLOW_TO relationships carrying quantity and composition deltas. F(A,B) represents flow from A to B
- **Loss/Gain**: Optional virtual loss container "L(O)"
- **Weightags**: Received grape or wine quantities acting as leaves in the operation graph. W1, W2, ...

A(n+1) = A(n) + Sum(F(*, A))
B(n) = B(n+1) - Sum(F(B, *))

### Composition Blending
Regadless of the number of operation containers, compositions are blended proportionally based on quantities. Note that all compositions are represented as absolute quantities (e.g., h-units of each varietal) rather than percentages.


### Loss Handling Algebra
- Pre-op losses: Flows from input to loss container before blending
- Post-op losses: Flows from output to loss container after blending
- Gains: Negative flows (wine "found")
- Real dollars flow with physical changes; nominal dollars conserved

### Rounding Method
On the top level quantities, there is no rounding, everything is based on absolute integer h-units.

Each container has a quantity Q.
Each outgoing flow has a quantity q and the sum of all outgoing q must equal Q.

However the proportion q/Q may not be an integer and applies to the invidual composition attributes.

Starting with Q:

Iteratively, for each F:
- For each composition attribute C in container:
  - Calculate attribute quantity c = C * q / Q, using standard integer division (floor)
  - Q -= q
  - C -= c

  on the last iteration, q = Q, so the remainder is assigned to the last flow, ensuring total conservation.

Repeat the process for all "negative" flows.
Note that a container state will have either 0 flows, or, both a set of positive and negative flows that sum to zero.
Negative flows are calculated using Abs(q) and then negated at the end.

Further testing and conceptual validation of this rounding method is needed.

---

## 🛠️ Utilities

- **[CompositionHelpers.ts](CompositionHelpers.ts)**: Functions for blending compositions, calculating proportions, often consumed from the client
- **[WineryOperationService.ts](WineryOperationService.ts)**: High-level operation builders and validators
- **[ValidationResult.ts](ValidationResult.ts)**: Typed results for invariant checks

**Stub: Rounding algorithms (e.g., banker's rounding, deterministic distribution of remainders).**
