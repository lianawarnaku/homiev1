import { Router, type IRouter } from "express";
import healthRouter from "./health";
import planningRouter from "./planning";

const router: IRouter = Router();

router.use(healthRouter);
router.use(planningRouter);

export default router;
