# 🔧 Core Layer: Invariants & Validation

The core layer is where the algorithmic implements Grapefruit's business rules and mathematical integrity. It provides utilities for composition calculations, invariant validation, and operation algebra—ensuring conservation of quantities, dollars, and lineage across winery transformations.

This layer sits between the domain (abstract models, see [domain/README.md](../domain/README.md)) and DB (persistence, see [db/README.md](../db/README.md)), turning business concepts into concrete numerical representations..

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
