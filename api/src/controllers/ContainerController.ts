import { Request, Response } from "express";
import { getDriver } from "../db/client";
import { ContainerRepo } from "../db/repositories/ContainerRepo";

export class ContainerController {
  static async getAllContainers(req: Request, res: Response) {
    const driver = getDriver();
    const session = driver.session();
    try {
      const repo = new ContainerRepo(session);
      const containers = await repo.findAll();
      res.json(containers);
    } catch (error) {
      console.error("Error fetching containers:", error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      await session.close();
    }
  }

  static async getContainerById(req: Request, res: Response) {
    const driver = getDriver();
    const session = driver.session();
    try {
      const repo = new ContainerRepo(session);
      const { id } = req.params;
      const container = await repo.findById(id);
      
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      
      res.json(container);
    } catch (error) {
      console.error(`Error fetching container ${req.params.id}:`, error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      await session.close();
    }
  }
}
