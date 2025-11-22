
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();
  try {
    console.log("Creating indexes...");

    await session.run("CREATE CONSTRAINT container_id IF NOT EXISTS FOR (c:Container) REQUIRE c.id IS UNIQUE");
    console.log("Created constraint for Container.id");

    await session.run("CREATE CONSTRAINT container_state_id IF NOT EXISTS FOR (s:ContainerState) REQUIRE s.id IS UNIQUE");
    console.log("Created constraint for ContainerState.id");

    await session.run("CREATE CONSTRAINT winery_operation_id IF NOT EXISTS FOR (o:WineryOperation) REQUIRE o.id IS UNIQUE");
    console.log("Created constraint for WineryOperation.id");

    await session.run("CREATE CONSTRAINT weigh_tag_id IF NOT EXISTS FOR (w:WeighTag) REQUIRE w.id IS UNIQUE");
    console.log("Created constraint for WeighTag.id");

    console.log("Indexes created successfully.");
  } catch (e) {
    console.error("Error creating indexes:", e);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
