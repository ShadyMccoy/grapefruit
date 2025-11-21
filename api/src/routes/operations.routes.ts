import { Router } from "express";
import { OperationController } from "../controllers/OperationController";

const router = Router();

router.get("/", OperationController.getAllOperations);
router.get("/:id", OperationController.getOperationById);
router.post("/", OperationController.createOperation);

export default router;
