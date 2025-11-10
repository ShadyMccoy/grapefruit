// src/scripts/cleanDb.ts
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("Cleaning database...");

    // Delete all nodes and relationships
    await session.run("MATCH (n) DETACH DELETE n");

    console.log("Database cleaned successfully!");
  } catch (error) {
    console.error("Failed to clean database:", error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();