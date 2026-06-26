import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { getOverview } from "./analytics.controller.js";

const router = Router();

router.get("/overview", authenticate, getOverview);

export default router;
