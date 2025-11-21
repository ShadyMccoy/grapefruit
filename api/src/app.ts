import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { getDriver } from "./db/client";
import routes from "./routes";

// Patch BigInt toJSON to avoid serialization errors
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

dotenv.config();

export const app = express();

// Middleware
app.use(express.json());

// Initialize DB connection
getDriver();

app.get("/", async (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Grapefruit API running" });
});

// API Routes
app.use("/api", routes);
