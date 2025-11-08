# 🗺️ Grapefruit Roadmap

This document tracks major milestones and planned phases of Grapefruit’s development.

---

## ✅ Completed

- [x] Core ontology: Containers, States, Operations  
- [x] Neo4j connectivity via TypeScript driver  
- [x] Basic invariant definitions (volume, lineage, immutability)

---

## 🚧 In Progress: Ontology Validation Phase

**Goal:** Validate the correctness of the graph model and dual-dollar algebra.  
Focus:
- Create and query operations in Neo4j
- Test volume and dollar conservation
- Implement simple “Hello World” operations (transfer, blend)

---

## 🔜 Next Phases

### **Phase 2 — Application Scaffolding**
- REST endpoints for CRUD on containers and operations  
- Type-safe repository interfaces  
- Invariant enforcement on mutation  

### **Phase 3 — Audit & Snapshot Engine**
- Time-travel queries (reconstruct state at any timestamp)  
- Export utilities for compliance  

### **Phase 4 — Frontend Visualization**
- React-based lineage maps and Sankey diagrams  
- Operation tracing and state diff visualization  

### **Phase 5 — ERP Integration**
- Connect to Dynamics 365 / Business Central  
- Map operations to accounting transactions  

### **Phase 6 — Validation Rules & Permissions**
- User and role-based access control  
- Operational approvals and audit workflows  

---

## 🧭 Long-Term Vision

Grapefruit aims to become a **universal truth engine** for process-based manufacturing —  
providing mathematically provable traceability for any domain where balance, lineage, and provenance matter.
