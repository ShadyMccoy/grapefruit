// src/scripts/testWineryOperations.ts
import { getDriver } from "../db/client";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { FlowToRelationship } from "../domain/relationships/Movement";
import { randomUUID } from "crypto";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const inputStateIds = ["tank1", "tank2"];
    const outputStates = [
      { containerId: "tank1", stateId: `state_${randomUUID()}`, volumeLiters: 200, composition: { chardonnay: 1.0 } }
    ];

    const flows: FlowToRelationship[] = inputStateIds.map(inputId => ({
      from: { id: inputId },
      to: { id: outputStates[0].stateId },
      properties: { qty: 100, unit: "L", composition: { chardonnay: 0.5 } }
    }));

    // Create operation
    const opId = await WineryOperationRepo.createOperation(
      { id: randomUUID(), tenantId: 'default', createdAt: new Date(), type: "blend", description: "Fake blend operation" },
      inputStateIds,
      outputStates,
      flows
    );

    console.log("Created fake operation with id:", opId);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
