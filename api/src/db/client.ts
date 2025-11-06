import neo4j, { Driver } from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

let driver: Driver;

export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASS || process.env.NEO4J_PASSWORD || "testpassword"
      )
    );
  }
  return driver;
}
