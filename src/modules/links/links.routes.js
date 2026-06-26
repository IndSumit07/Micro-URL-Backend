/**
 * @file links.routes.js
 * @description Express router for the links module.
 *
 * Route map
 * ─────────
 *  POST   /api/links           Create a new short link (guest + authenticated)
 *  GET    /api/links           List all links for the authenticated user
 *  GET    /api/links/count     Get the total link count for the authenticated user
 *  GET    /api/links/:id       Get a single link by UUID
 *  PATCH  /api/links/:id       Update a link's mutable fields
 *  DELETE /api/links/:id       Permanently delete a link
 *
 * Middleware stack per route
 * ──────────────────────────
 *  POST   /        → createLinkLimiter → optionalAuth → validate(body) → controller
 *  GET    /        → authenticate      → validate(query) → controller
 *  GET    /count   → authenticate      → controller  (MUST be before /:id)
 *  GET    /:id     → authenticate      → validate(params) → controller
 *  PATCH  /:id     → authenticate      → validate(params) → validate(body) → controller
 *  DELETE /:id     → authenticate      → validate(params) → controller
 *
 * ⚠️  Auth behaviour by environment
 *  development  → `authenticate` and `optionalAuth` inject a stub user
 *                 automatically — no token needed.
 *  production   → real JWT verification via Supabase JWKS.
 */

import { Router } from "express";

// Middlewares
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createLinkLimiter } from "../../middlewares/rateLimiter.middleware.js";

// Controllers
import {
  createLink,
  getUserLinks,
  getLink,
  updateLink,
  deleteLink,
  getLinkCount,
} from "./links.controller.js";

// Validation schemas
import {
  createLinkSchema,
  updateLinkSchema,
  getLinkParamsSchema,
  getUserLinksQuerySchema,
} from "./links.validation.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  POST /api/links
 * @desc   Create a new short link. Requires authentication.
 *         Rate-limited to prevent abuse.
 */
router.post(
  "/",
  createLinkLimiter,
  authenticate,
  validate(createLinkSchema, "body"),
  createLink,
);

/**
 * @route  GET /api/links
 * @desc   List all links owned by the authenticated user.
 *         Supports pagination via `?page` and `?limit` query params.
 */
router.get(
  "/",
  authenticate,
  validate(getUserLinksQuerySchema, "query"),
  getUserLinks,
);

/**
 * @route  GET /api/links/count
 * @desc   Return the total number of links for the authenticated user.
 *         ⚠️ This route MUST be declared before `/:id` to avoid Express
 *            treating "count" as a UUID parameter.
 */
router.get("/count", authenticate, getLinkCount);

/**
 * @route  GET /api/links/:id
 * @desc   Retrieve a single link by its UUID.
 */
router.get(
  "/:id",
  authenticate,
  validate(getLinkParamsSchema, "params"),
  getLink,
);

/**
 * @route  PATCH /api/links/:id
 * @desc   Update mutable fields (title, expiresAt, status) on a link.
 */
router.patch(
  "/:id",
  authenticate,
  validate(getLinkParamsSchema, "params"),
  validate(updateLinkSchema, "body"),
  updateLink,
);

/**
 * @route  DELETE /api/links/:id
 * @desc   Permanently delete a link.
 */
router.delete(
  "/:id",
  authenticate,
  validate(getLinkParamsSchema, "params"),
  deleteLink,
);

export default router;
