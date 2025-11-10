# 🏭 Winery Workflow Model

This document maps **real-world winery operations** to Grapefruit’s **graph and algebra model**.  
It explains how physical and accounting events are represented as mix operations.

---

## 🧠 Work Order Flow

1. Operator initiates a work order (transfer, blend, etc.).
2. System records inputs and planned outputs.
3. Optional measurements captured as Observations.
4. Operation executes:
   - Inputs consumed
   - Outputs created
   - Invariants validated (when implemented)
5. UI reflects new states and historical lineage.

---

## 🔄 Operation Types

### Blend Operation
**Real-world**: Mixing wine from multiple tanks into a single output tank.

**Graph Representation**:
- Input states: Current states of source containers
- Output state: New state for destination container with combined qty and blended composition
- Flows: FLOW_TO relationships from each input to output with proportional compositions
- Operation: WineryOperation with type 'blend'

**Example**: Blend 100 gal from Tank 1 (chardonnay) + 100 gal from Tank 2 (pinot) → 200 gal in Tank 3 (50% chardonnay, 50% pinot)

### Transfer Operation
**Real-world**: Moving wine from one container to another.

**Graph Representation**:
- Input state: Current state of source container
- Output state: New state for destination container (same composition)
- Flows: FLOW_TO from input to output
- Operation: WineryOperation with type 'transfer'

### Bottling Operation
**Real-world**: Filling bottles from a tank.

**Graph Representation**:
- Input state: Current state of tank
- Output states: New states for bottle containers (multiple bottles)
- Flows: FLOW_TO from tank to each bottle
- Operation: WineryOperation with type 'bottle'

### Loss Handling
**Real-world**: Accounting for evaporation, spoilage, or gains.

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