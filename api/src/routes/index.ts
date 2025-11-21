import { Router } from "express";
import operationRoutes from "./operations.routes";
import compositionRoutes from "./composition.routes";
import containerRoutes from "./containers.routes";

const router = Router();

router.use("/operations", operationRoutes);
router.use("/composition", compositionRoutes);
router.use("/containers", containerRoutes);

export default router;
