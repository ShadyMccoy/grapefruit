import { Router } from "express";
import { ContainerController } from "../controllers/ContainerController";

const router = Router();

router.get("/", ContainerController.getAllContainers);
router.get("/:id", ContainerController.getContainerById);

export default router;
