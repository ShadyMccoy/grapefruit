import { Router } from "express";
import { CompositionController } from "../controllers/CompositionController";

const router = Router();

router.post("/calculate-flow", CompositionController.calculateFlow);
router.post("/calculate-blend", CompositionController.calculateBlend);

export default router;
