// Dynamic test for transfer operation built from containers
import { WineryOperationService } from "../core/WineryOperationService";

async function run() {
  const id = "transfer_dynamic_001";
  const tenantId = "winery1";
  const fromContainerId = "tankA";
  const toContainerId = "tankB";
  const qty = 50; // gallons
  const createdAt = new Date();

  try {
    console.log("Building transfer operation dynamically...");
    const op = await WineryOperationService.buildTransferOperation({
      id,
      tenantId,
      fromContainerId,
      toContainerId,
      qty,
      createdAt,
      description: `Transfer ${qty} from ${fromContainerId} to ${toContainerId}`
    });

    console.log("Creating operation...");
    const result = await WineryOperationService.createOperation(op);
    console.log("Dynamic transfer created:", result);
  } catch (err) {
    console.error("Dynamic transfer failed:", err);
  }
}

run();
