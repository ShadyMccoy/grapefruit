// src/scripts/testWineryOperations.ts
import { getDriver } from "../db/client";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";
import { WineryOpInput, WineryOpOutput } from "../domain/relationships/Movement";

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const inputIds = ["tank1", "tank2"];
    const outputIds = ["tank1"];

    const inputs: WineryOpInput[] = inputIds.map((id) => ({
      from: { id }, 
      to: {} as any, 
      properties: { qty: 100, unit: "L", description: "Fake input" },
    }));

    // Build fake outputs
    const outputs: WineryOpOutput[] = outputIds.map((id) => ({
      from: {} as any, // placeholder, repo handles linking from operation
      to: { id },      // minimal pretotype, just the ID
      properties: { qty: 200, unit: "L" },
    }));

    // Create operation
    const opId = await WineryOperationRepo.createOperation(
      { type: "blend", description: "Fake blend operation" },
      inputs,
      outputs
    );

    console.log("Created fake operation with id:", opId);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
