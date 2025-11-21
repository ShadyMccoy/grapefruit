import { Request, Response } from "express";
import { ContainerState } from "../domain/nodes/ContainerState";
import { QuantifiedComposition } from "../domain/nodes/QuantifiedComposition";
import {
  distributeComposition,
  blendCompositions
} from "../core/CompositionHelpers";

export class CompositionController {
  static async calculateFlow(req: Request, res: Response) {
    try {
      const { inputState, flowQty }: { inputState: ContainerState; flowQty: bigint } = req.body;

      if (!inputState || flowQty === undefined) {
        return res.status(400).json({ error: "Missing inputState or flowQty" });
      }

      // Note: In a real request, BigInts might come as strings/numbers. 
      // We might need a middleware or utility to handle BigInt serialization/deserialization for JSON.
      // For now, assuming the body parser handles it or the user sends compatible types.
      // However, standard JSON.parse doesn't handle BigInt. 
      // We'll assume for this refactor we are just moving code.
      
      const flowCompositions = distributeComposition(inputState.quantifiedComposition, [{
        qty: BigInt(flowQty), // Ensure BigInt
        accepts: { physical: true, cost: true, value: true }
      }]);
      res.json({ flowCompositions });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async calculateBlend(req: Request, res: Response) {
    try {
      const { compositions }: { compositions: QuantifiedComposition[] } = req.body;

      if (!compositions || !Array.isArray(compositions)) {
        return res.status(400).json({ error: "Missing or invalid compositions array" });
      }

      const composition = blendCompositions(compositions);
      res.json({ composition });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
