// src/scripts/helloContainers.ts
import neo4j from "neo4j-driver";
import { ContainerRepo } from "../db/repositories/ContainerRepo";

async function main() {
  const driver = neo4j.driver(
    "bolt://localhost:7687",  
    neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASS || "password"
    )
  );
  const session = driver.session();

  try {
    const containerRepo = new ContainerRepo(session);

    // Fully typed retrieval
    const containers = await containerRepo.findAll();

    console.log("Containers in DB:", containers);
  } catch (err) {
    console.error("Error retrieving containers:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
