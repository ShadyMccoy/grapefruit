// Deterministic transfer test: move 50 gallons from Tank A to Tank B.
import { WineryOperationService } from "../core/WineryOperationService";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { getDriver } from "../db/client";
import { replacer } from "../util/json";

async function testTransfer() {
  console.log("--- Running Tank Transfer Test ---");
  const driver = getDriver();
  const session = driver.session();

  try {
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("Cleaned database.");

    const containerRepo = new ContainerRepo(session);
    const tankA: Container = {
      id: "tankA",
      name: "Tank A",
      tenantId: "winery1",
      type: "tank",
      capacityHUnits: 2000,
      createdAt: new Date(),
    };
    const tankB: Container = {
      id: "tankB",
      name: "Tank B",
      tenantId: "winery1",
      type: "tank",
      capacityHUnits: 2000,
      createdAt: new Date(),
    };
    await containerRepo.create(tankA);
    await containerRepo.create(tankB);

    const stateRepo = new ContainerStateRepo(session);
    const now = new Date();
    const stateA: ContainerState = {
      id: "state_tankA_initial",
      tenantId: "winery1",
      createdAt: now,
      timestamp: now,
      container: tankA,
      isHead: true,
      quantifiedComposition: {
        qty: 1000n,
        unit: "gal",
        attributes: {
          varietal: {
            CHARD: 1000n,
          },
        },
      },
      flowsTo: [],
      flowsFrom: [],
    };

    const stateB: ContainerState = {
      id: "state_tankB_initial",
      tenantId: "winery1",
      createdAt: now,
      timestamp: now,
      container: tankB,
      isHead: true,
      quantifiedComposition: {
        qty: 800n,
        unit: "gal",
        attributes: {
          varietal: {
            PINOT: 800n,
          },
        },
      },
      flowsTo: [],
      flowsFrom: [],
    };

    await stateRepo.create(stateA);
    await stateRepo.create(stateB);
    console.log("Seeded initial states for tankA/tankB.");

    const op = await WineryOperationService.buildWineryOperation({
      id: "transfer_test_001",
      type: "transfer",
      description: "Transfer 50 gallons from Tank A to Tank B",
      tenantId: "winery1",
      createdAt: new Date(),
      fromContainers: [stateA, stateB],
      flowQuantities: [
        {
          fromStateId: stateA.id,
          toStateId: tankB.id,
          qty: 50n,
        },
      ],
    });

    console.log("Committing transfer operation...");
    const result = await WineryOperationService.validateAndCommitOperation(op);
    console.log("Transfer operation created successfully.");

    if (result.outputStates) {
      console.log(
        "\nOutput states:",
        JSON.stringify(result.outputStates, replacer, 2)
      );
    }
  } catch (error) {
    console.error("Transfer operation failed:", error);
  } finally {
    await session.close();
    await driver.close();
    console.log("--- Test Complete ---");
  }
}

testTransfer();
