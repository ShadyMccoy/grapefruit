// Sequential dynamic transfers: 50 gal A -> B, then 100 gal B -> A
import { WineryOperationService } from "../core/WineryOperationService";

async function run() {
  const tenantId = "winery1";
  const createdAt1 = new Date();

  try {
    console.log("Building op 1: 50 from tankA to tankB...");
    const op1 = await WineryOperationService.buildTransferOperation({
      id: "transfer_seq_001",
      tenantId,
      fromContainerId: "tankA",
      toContainerId: "tankB",
      qty: 50,
      createdAt: createdAt1,
      description: "Seq1: 50 A->B"
    });
    console.log("Creating op 1...");
    const res1 = await WineryOperationService.createOperation(op1);
    console.log("Op1 created:", res1.id);

    // Slightly later timestamp for ordering determinism
    const createdAt2 = new Date(createdAt1.getTime() + 1000);

    console.log("Building op 2: 100 from tankB to tankA...");
    const op2 = await WineryOperationService.buildTransferOperation({
      id: "transfer_seq_002",
      tenantId,
      fromContainerId: "tankB",
      toContainerId: "tankA",
      qty: 100,
      createdAt: createdAt2,
      description: "Seq2: 100 B->A"
    });
    console.log("Creating op 2...");
    const res2 = await WineryOperationService.createOperation(op2);
    console.log("Op2 created:", res2.id);
  } catch (err) {
    console.error("Sequence failed:", err);
  }
}

run();
