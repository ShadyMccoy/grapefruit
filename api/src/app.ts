import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { getDriver } from "./db/client";
import routes from "./routes";
import { typeDefs } from "./graphql/typeDefs";
import { resolvers } from "./graphql/resolvers";
import { createContext } from "./graphql/context";

// Patch BigInt toJSON to avoid serialization errors
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

dotenv.config();

export const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DB connection
getDriver();

app.get("/", async (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Grapefruit API running" });
});

// API Routes
app.use("/api", routes);

// Apollo Server Setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

export async function startApolloServer() {
  await server.start();
  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: createContext,
    }) as any
  );
}
