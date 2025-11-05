import { Movement, ResultedIn } from "../relationships/Movement";

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

  inputs?: Movement[];
  outputs?: ResultedIn[];
}
