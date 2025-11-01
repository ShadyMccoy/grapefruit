import express, { Request, Response } from "express";

import dotenv from "dotenv";
import neo4j from "neo4j-driver";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
