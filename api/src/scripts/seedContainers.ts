// src/scripts/seedContainers.ts
import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { Container } from "../domain/nodes/Container";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const repo = new ContainerRepo(session);

    const containers: Container[] = [
      { id: "tank1", name: "Tank 1", type: "tank", capacityLiters: 1000, tenantId: "winery1", createdAt: new Date() },
      { id: "tank2", name: "Tank 2", type: "tank", capacityLiters: 800, tenantId: "winery1", createdAt: new Date() },
      { id: "barrelA", name: "Barrel A", type: "barrel", capacityLiters: 225, tenantId: "winery1", createdAt: new Date() },
      { id: "barrelB", name: "Barrel B", type: "barrel", capacityLiters: 225, tenantId: "winery1", createdAt: new Date() },
    ];

    for (const c of containers) {
      await repo.create(c);
    }

    console.log("Seeded containers:", containers.map(c => c.name));
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
