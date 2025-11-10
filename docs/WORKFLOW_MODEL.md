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
   - Invariants validated
5. UI reflects new states and historical lineage.

---

## ✅ Outcome

This workflow model ensures:
- Physical actions map directly to graph operations.
- Accounting values remain auditable.
- Gain/Loss and LossContainer keep discrepancies explicit.