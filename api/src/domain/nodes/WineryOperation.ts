import { WineryOpInput, WineryOpOutput } from "../relationships/Movement";

export type OperationType =
  | "transfer"
  | "blend"
  | "bottle"
  | "loss"
  | "adjustment";

export interface WineryOperation {
  id?: string;
  type: OperationType;
  description?: string;

  inputs?: WineryOpInput[];
  outputs?: WineryOpOutput[];
}
