# 🤖 AI Collaboration Guidelines

Grapefruit is designed for **AI–human co-development**.  
This document defines how AI agents and human contributors should reason about, modify, and extend the system.

---

## 🧭 Purpose

To ensure AI-generated code:
- Preserves **truth invariants**.
- Matches **ontology terminology**.
- Produces **explainable, auditable** reasoning and code.

---

## 🧩 Reasoning Hierarchy

When generating or editing code, AI agents should reason in this order:

1. **Graph Ontology** → (`docs/GRAPH_MODEL.md`)
2. **Domain & Repositories** → (`docs/APPLICATION_LOGIC.md`)
3. **Workflow Semantics** → (`docs/WORKFLOW_MODEL.md`)
4. **Integration Logic** → API, ERP interfaces
5. **Infrastructure** → Docker, environment, CI/CD

Never modify code without checking alignment with these documents.

---

## 💬 Coding Guidelines

- Use **precise naming** from the ontology (Container, ContainerState, Operation).  
- Always **explain intent** in comments — not just implementation.  
- When uncertain, **ask or annotate** assumptions clearly.  
- Do not introduce randomness, timestamps, or environmental variance.  
- Maintain **determinism** across all generated functions.

---

## 🧱 Commenting Convention

```ts
// Intent: Create new ContainerState preserving volume and nominal balance
// Reasoning: Inputs validated; lineage preserved; invariant check required before commit
```

AI collaborators must leave these “intent” comments for human reviewers.

### Human Oversight

All schema or ontology changes require human review and approval.

AI may propose modifications but must flag them as // Suggestion: or // Requires review:.

Merge actions should only occur after validation of balance and lineage logic.

### Example: Good AI Contribution

```ts
// Intent: Implement LossContainer adjustment during blend operations
// Suggestion: Extend OperationRepo.createOperation to accept virtual inputs
// Requires review: Verify loss handling logic with invariant module

const lossInput = await containerRepo.findByType('loss');
await operationRepo.createOperation({
  type: 'blend',
  inputs: [...inputStates, lossInput],
  outputs: [newOutput],
});
```
## Goal

AI collaboration in Grapefruit should amplify precision, not creativity.
Every contribution must strengthen auditability, not complexity.