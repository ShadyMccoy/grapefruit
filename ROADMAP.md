# 🗺️ Grapefruit Roadmap

This document tracks major milestones and planned phases of Grapefruit’s development.

---

## ✅ Completed

- [x] Core ontology: Containers, States, WineryOperations
- [x] Neo4j connectivity via TypeScript driver
- [x] Basic invariant definitions (qty, lineage, immutability)
- [x] Repository pattern implementation
- [x] Dual-dollar accounting model
- [x] H-units for precision (1/10,000 gallon/pound)
- [x] Comprehensive seeding infrastructure

---

## 🚧 Current Phase: Ontology Validation

**Goal:** Validate the correctness of the graph model and dual-dollar algebra.
**Status:** In progress - domain model solidified, testing infrastructure ready.

Focus:
- Execute operations in Neo4j with proper relationships
- Test qty and dollar conservation
- Validate lineage and immutability
- Refine invariants before full enforcement

- test scaling: 100, 1000, 10000 or even 1 million operations
- performance profiling and optimization

---

## 🔜 Next Phases

### **Phase 2 — Application Scaffolding**
- REST endpoints for CRUD on containers and operations  
- Type-safe repository interfaces  
- Invariant enforcement on mutation  

### **Phase 5 — Frontend Visualization**
- React-based lineage maps and Sankey diagrams  
- Operation tracing and state diff visualization  

### **Phase 4 — Audit & Snapshot Engine**
- Time-travel queries (reconstruct state at any timestamp)  
- Export utilities for compliance  

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
