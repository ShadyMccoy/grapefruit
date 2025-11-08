# 🏭 Winery Workflow Model

This document maps **real-world winery operations** to Grapefruit’s **graph and algebra model**.  
It explains how physical and accounting events are represented as mix operations.

---

## 🍷 Core Workflow Concepts

### **Work Orders**
- Represent physical cellar activities.
- Each work order maps to a `WineryOperation` node.
- Metadata: operator, work order ID, type, timestamp, planned vs actual.

### **Observations**
- Optional records of measurement or correction.
- Include:
  - Volume observed
  - Real and nominal dollars
  - Timestamp and operator
  - Correction reason

Unobserved operations are supported (assumed balance based on planned volumes).

---

## ⚗️ Operation Types

| Type | Description | Inputs → Outputs |
|------|--------------|------------------|
| **Transfer** | Moves wine between containers. | 1 → 1 |
| **Blend** | Mixes multiple sources into one. | N → 1 |
| **Split** | Divides one source into multiple destinations. | 1 → M |
| **Pressing** | Converts must into juice and pomace. | 1 → 2 |
| **Bottling** | Moves from tank to bottle containers. | 1 → M |
| **Measurement Correction** | Adjusts state via Gain/Loss. | 1 + Gain/Loss → 1 |

---

## 💵 Dual-Dollar System

Each container state tracks:
- **Real dollars** — tied to physical wine (changes with evaporation, spoilage).
- **Nominal dollars** — tracks accounting value; conserved across operations.

| Container | Real | Nominal |
|------------|-------|----------|
| Tank A | $1000 | $1020 |
| Gain/Loss | $0 | $20 |
| LossContainer | −$50 | $0 |

Real dollars represent *physical reality*; nominal dollars represent *book truth*.

---

## 🧩 Gain/Loss Handling

**Gain/Loss containers** model discrepancies between expected and observed volumes.  
They allow small reconciliations without violating conservation rules.

Example:


TankA @ t0 (100 gal / $1000)
GainLoss (+2 gal / $20 nominal / $0 real)
→ MIX → TankA @ t1 (102 gal / $1020 nominal / $1000 real)


---

## 💨 Loss Containers

Used to model evaporation, spills, or spoilage.

Example:


TankB @ t0 (500 gal / $5000)
LossContainer (-5 gal / $0 nominal / $50 real)
→ MIX → TankB @ t1 (495 gal / $5000 nominal / $4950 real)


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

## 🧮 Graph Example (Blend)



TankA @ t0 (400 gal / $4000)
TankB @ t0 (300 gal / $3000)
→ BLEND →
TankC @ t1 (700 gal / $7000)


Graph:


(TankA:t0)-[:WINERY_OP_INPUT]->(BlendOp)
(TankB:t0)-[:WINERY_OP_INPUT]->(BlendOp)
(BlendOp)-[:WINERY_OP_OUTPUT]->(TankC:t1)


---

## ✅ Outcome

This workflow model ensures:
- Physical actions map directly to graph operations.
- Accounting values remain auditable.
- Gain/Loss and LossContainer keep discrepancies explicit.