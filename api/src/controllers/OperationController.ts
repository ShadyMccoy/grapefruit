import { Request, Response } from "express";
import { WineryOperation } from "../domain/nodes/WineryOperation";
import { WineryOperationService } from "../core/WineryOperationService";
import { WineryOperationRepo } from "../db/repositories/WineryOperationRepo";

export class OperationController {
  static async getAllOperations(req: Request, res: Response) {
    try {
      const operations = await WineryOperationRepo.findAll();
      res.json(operations);
    } catch (error) {
      console.error("Error fetching operations:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getOperationById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operation = await WineryOperationRepo.getOperation(id);
      
      if (!operation) {
        return res.status(404).json({ error: "Operation not found" });
      }
      
      res.json(operation);
    } catch (error) {
      console.error(`Error fetching operation ${req.params.id}:`, error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createOperation(req: Request, res: Response) {
    try {
      const operation: WineryOperation = req.body;

      // Validate required fields
      if (!operation.id || !operation.type || !operation.tenantId) {
        return res.status(400).json({
          error: "Missing required fields: id, type, tenantId"
        });
      }

      // Create the operation
      const createdOperation = await WineryOperationService.validateAndCommitOperation(operation);

      res.json(createdOperation);
    } catch (error) {
      console.error("Operation creation failed:", error);
      res.status(400).json({
        error: (error as Error).message
      });
    }
  }
}
