import express, { Request, Response } from "express";
import { WineryOperation } from "./domain/nodes/WineryOperation";
import { WineryOperationService } from "./core/WineryOperationService";
import { ContainerState } from "./domain/nodes/ContainerState";
import {
  calculateFlowComposition,
  calculateBlendComposition,
  generateFlowCompositions
} from "./core/CompositionHelpers";

import dotenv from "dotenv";
import neo4j from "neo4j-driver";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Create Neo4j driver (stub values for now)
const driver = neo4j.driver(
  process.env.NEO4J_URI || "neo4j://localhost",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASS || "password"
  )
);

app.get("/", async (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Grapefruit API running" });
});

app.post("/api/operations", async (req: Request, res: Response) => {
  try {
    const operation: WineryOperation = req.body;

    // Validate required fields
    if (!operation.id || !operation.type || !operation.tenantId) {
      return res.status(400).json({
        error: "Missing required fields: id, type, tenantId"
      });
    }

    // Create the operation
    const createdOperation = await WineryOperationService.createOperation(operation);

    res.json(createdOperation);
  } catch (error) {
    console.error("Operation creation failed:", error);
    res.status(400).json({
      error: (error as Error).message
    });
  }
});

// Composition calculation helpers for front-end
app.post("/api/composition/calculate-flow", async (req: Request, res: Response) => {
  try {
    const { inputState, flowQty }: { inputState: ContainerState; flowQty: number } = req.body;

    if (!inputState || flowQty === undefined) {
      return res.status(400).json({ error: "Missing inputState or flowQty" });
    }

    const composition = calculateFlowComposition(inputState, flowQty);
    res.json({ composition });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/composition/calculate-blend", async (req: Request, res: Response) => {
  try {
    const { incomingState, flows } = req.body;

    if (!incomingState || !flows || !Array.isArray(flows)) {
      return res.status(400).json({ error: "Missing or invalid incomingState or flows array" });
    }

    const composition = calculateBlendComposition(incomingState, flows);
    res.json({ composition });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/composition/generate-transfer", async (req: Request, res: Response) => {
  try {
    const { fromComposition, transferQty } = req.body;

    if (!fromComposition || transferQty === undefined) {
      return res.status(400).json({ error: "Missing fromComposition or transferQty" });
    }

    const flows = generateFlowCompositions(fromComposition, transferQty);
    res.json({ flows });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

app.get("/testdb", async (_req: Request, res: Response) => {
  const session = driver.session();
  try {
    const result = await session.run("RETURN 1 AS num");
    await session.close();
    res.json({ success: true, value: result.records[0].get("num") });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
