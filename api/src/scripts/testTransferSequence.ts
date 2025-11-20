// Sequential dynamic transfers: 50 gal A -> B, then 100 gal B -> A
import { WineryOperationService } from "../core/WineryOperationService";
import { ContainerRepo } from "../db/repositories/ContainerRepo";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";
import { Container } from "../domain/nodes/Container";
import { ContainerState } from "../domain/nodes/ContainerState";
import { getDriver } from "../db/client";

async function run() {
  const tenantId = "winery1";
  const createdAt1 = new Date();

  const driver = getDriver();
  const session = driver.session();

  try {
    // Clean and seed
    await session.run("MATCH (n) DETACH DELETE n");
    const containerRepo = new ContainerRepo(session);
    const tankA: Container = {
      id: "tankA",
      name: "Tank A",
      tenantId,
      type: "tank",
      capacityHUnits: 2000,
      createdAt: createdAt1,
    };
    const tankB: Container = {
      id: "tankB",
      name: "Tank B",
      tenantId,
      type: "tank",
      capacityHUnits: 2000,
      createdAt: createdAt1,
    };
    await containerRepo.create(tankA);
    await containerRepo.create(tankB);

    const stateRepo = new ContainerStateRepo(session);
    const stateA: ContainerState = {
      id: "state_tankA_initial",
      tenantId,
      createdAt: createdAt1,
      timestamp: createdAt1,
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
      createdAt: createdAt1,
      timestamp: createdAt1,
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

    console.log("Building op 1: 50 from tankA to tankB...");
    const op1 = await WineryOperationService.buildWineryOperation({
      id: "transfer_seq_001",
      tenantId,
      createdAt: createdAt1,
      type: "transfer",
      description: "Seq1: 50 A->B",
      fromContainers: [stateA, stateB],
      flowQuantities: [
        { fromStateId: stateA.id, toStateId: tankB.id, qty: 50n },
      ],
    });
    console.log("Creating op 1...");
    const res1 = await WineryOperationService.validateAndCommitOperation(op1);
    console.log("Op1 created:", res1.id);

    // Get new head states
    const newStateA = await stateRepo.findCurrentByContainer("tankA");
    const newStateB = await stateRepo.findCurrentByContainer("tankB");
    if (!newStateA || !newStateB) throw new Error("Failed to get new head states");
    console.log("New state A ID:", newStateA.id, "Qty:", newStateA.quantifiedComposition.qty);
    console.log("New state B ID:", newStateB.id, "Qty:", newStateB.quantifiedComposition.qty);

    // Slightly later timestamp for ordering determinism
    const createdAt2 = new Date(createdAt1.getTime() + 1000);

    console.log("Building op 2: 100 from tankB to tankA...");
    const op2 = await WineryOperationService.buildWineryOperation({
      id: "transfer_seq_002",
      tenantId,
      createdAt: createdAt2,
      type: "transfer",
      description: "Seq2: 100 B->A",
      fromContainers: [newStateA, newStateB],
      flowQuantities: [
        { fromStateId: newStateB.id, toStateId: tankA.id, qty: 100n },
      ],
    });
    console.log("Creating op 2...");
    const res2 = await WineryOperationService.validateAndCommitOperation(op2);
    console.log("Op2 created:", res2.id);
  } catch (err) {
    console.error("Sequence failed:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
