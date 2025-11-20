// Dynamic test for transfer operation built from containers
import { WineryOperationService } from "../core/WineryOperationService";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { getDriver } from "../db/client";

async function run() {
  const id = "transfer_dynamic_001";
  const tenantId = "winery1";
  const fromContainerId = "tankA";
  const toContainerId = "tankB";
  const qty = 50n; // gallons
  const createdAt = new Date();

  const driver = getDriver();
  const session = driver.session();

  try {
    // Clean and seed
    await session.run("MATCH (n) DETACH DELETE n");
    const containerRepo = new ContainerRepo(session);
    const tankA: Container = {
      id: fromContainerId,
      name: "Tank A",
      tenantId,
      type: "tank",
      capacityHUnits: 2000,
      createdAt,
    };
    const tankB: Container = {
      id: toContainerId,
      name: "Tank B",
      tenantId,
      type: "tank",
      capacityHUnits: 2000,
      createdAt,
    };
    await containerRepo.create(tankA);
    await containerRepo.create(tankB);

    const stateRepo = new ContainerStateRepo(session);
    const stateA: ContainerState = {
      id: "state_tankA_initial",
      tenantId,
      createdAt,
      timestamp: createdAt,
      container: tankA,
      isHead: true,
      quantifiedComposition: {
        qty: 1000n,
        unit: "gal",
        attributes: { varietal: { CHARD: 1000n } },
      },
      flowsTo: [],
      flowsFrom: [],
    };
    const stateB: ContainerState = {
      id: "state_tankB_initial",
      tenantId,
      createdAt,
      timestamp: createdAt,
      container: tankB,
      isHead: true,
      quantifiedComposition: {
        qty: 800n,
        unit: "gal",
        attributes: { varietal: { PINOT: 800n } },
      },
      flowsTo: [],
      flowsFrom: [],
    };
    await stateRepo.create(stateA);
    await stateRepo.create(stateB);

    console.log("Building transfer operation dynamically...");
    const op = await WineryOperationService.buildWineryOperation({
      id,
      tenantId,
      createdAt,
      type: "transfer",
      description: `Transfer ${qty} from ${fromContainerId} to ${toContainerId}`,
      fromContainers: [stateA, stateB],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty },
      ],
    });

    console.log("Creating operation...");
    const result = await WineryOperationService.validateAndCommitOperation(op);
    console.log("Dynamic transfer created:", result);
  } catch (err) {
    console.error("Dynamic transfer failed:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
