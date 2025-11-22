
import { getDriver } from "../db/client";

async function main() {
  const driver = getDriver();
  const session = driver.session();
  try {
    const containerCount = await session.run("MATCH (c:Container) RETURN count(c) as count");
    console.log("Containers:", containerCount.records[0].get("count").toString());

    const stateCount = await session.run("MATCH (s:ContainerState) RETURN count(s) as count");
    console.log("ContainerStates:", stateCount.records[0].get("count").toString());

    const opCount = await session.run("MATCH (o:WineryOperation) RETURN count(o) as count");
    console.log("WineryOperations:", opCount.records[0].get("count").toString());

    const indexes = await session.run("SHOW INDEXES");
    console.log("Indexes:");
    indexes.records.forEach(r => {
        console.log(`- ${r.get("name")}: ${r.get("labelsOrTypes")} ${r.get("properties")}`);
    });

  } finally {
    await session.close();
    await driver.close();
  }
}

main();
