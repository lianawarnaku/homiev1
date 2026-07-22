import { Router, type IRouter } from "express";
import healthRouter from "./health";
import planningRouter from "./planning";
import calendarRouter from "./calendar";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// Public: health checks (used by load balancers / uptime probes).
router.use(healthRouter);

// Everything below requires a valid Supabase access token.
router.use(requireAuth);
router.use(planningRouter);
router.use(calendarRouter);

export default router;
