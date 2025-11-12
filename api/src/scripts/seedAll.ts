// src/scripts/seedAll.ts
import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { starterData } from "./starterData";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log("Starting comprehensive seeding...");

    // Seed containers
    const containerRepo = new ContainerRepo(session);
    console.log(`Seeding ${starterData.containers.length} containers...`);
    for (const c of starterData.containers) {
      try {
        await containerRepo.create(c);
        console.log(`  Created container: ${c.name} (${c.id})`);
      } catch (error) {
        console.error(`  Failed to create container ${c.id}:`, error);
      }
    }

    // Seed container states
    const stateRepo = new ContainerStateRepo(session);
    console.log(`Seeding ${starterData.containerStates.length} container states...`);
    for (const s of starterData.containerStates) {
      try {
        await stateRepo.create(s);
        console.log(`  Created state: ${s.id} for container ${s.container.id}`);
      } catch (error) {
        console.error(`  Failed to create state ${s.id}:`, error);
      }
    }

    // Seed operations
    // const opRepo = new WineryOperationRepo();
    // console.log("Seeding transfer operation...");
    // try {
    //   const transferOpId = await WineryOperationRepo.createTransferOperation(
    //     'tankB', // from
    //     'tankA', // to
    //     50,      // transfer 50 gallons
    //     'winery1'
    //   );
    //   console.log(`  Created transfer operation: ${transferOpId}`);
    // } catch (error) {
    //   console.error("  Failed to create transfer operation:", error);
    // }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();