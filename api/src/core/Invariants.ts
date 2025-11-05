// core/Invariants.ts
import { ContainerState } from "../domain/ContainerState";
import { Operation } from "../domain/Operation";
import { ValidationResult } from "./ValidationResult";
import { ContainerStateRepo } from "../db/repositories/ContainerStateRepo";

export class Invariants {
  constructor(private containerStateRepo: ContainerStateRepo) {}

  /** Invariant 1: A container can only have one current state */
  async assertSingleCurrentState(containerId: string): Promise<ValidationResult> {
    const currentStates = await this.containerStateRepo.findCurrentByContainer(containerId);
    if (currentStates.length > 1) {
      return {
        ok: false,
        code: "MULTIPLE_CURRENT_STATES",
        message: `Container ${containerId} has multiple current states.`,
      };
    }
    return { ok: true };
  }

  /** Invariant 2: Conservation of volume */
  assertVolumeBalance(operation: Operation): ValidationResult {
    const totalIn = operation.inputs.reduce((sum, i) => sum + i.volumeLiters, 0);
    const totalOut = operation.outputs.reduce((sum, i) => sum + i.volumeLiters, 0);
    if (Math.abs(totalIn - totalOut) > 0.0001) {
      return {
        ok: false,
        code: "VOLUME_IMBALANCE",
        message: `Operation ${operation.id} violates volume conservation.`,
      };
    }
    return { ok: true };
  }

  /** Invariant 3: Every state must have exactly one predecessor (except initial) */
  assertSinglePredecessor(state: ContainerState): ValidationResult {
    if (!state.previousStateId && !state.isInitial) {
      return {
        ok: false,
        code: "MISSING_PREDECESSOR",
        message: `State ${state.id} missing predecessor.`,
      };
    }
    return { ok: true };
  }

  /** Batch check — evaluate all invariants for an operation before commit */
  async validateOperation(operation: Operation): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    results.push(this.assertVolumeBalance(operation));

    for (const output of operation.outputs) {
      results.push(this.assertSinglePredecessor(output));
      results.push(await this.assertSingleCurrentState(output.containerId));
    }

    return results.filter(r => !r.ok);
  }
}
