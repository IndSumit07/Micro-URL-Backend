/**
 * @file stats.routes.js
 * @description Public stats routes — no auth required.
 */
import { Router } from "express";
import { getPublicStats } from "./stats.controller.js";

const router = Router();

// GET /api/stats/public  — no auth
router.get("/public", getPublicStats);

export default router;
