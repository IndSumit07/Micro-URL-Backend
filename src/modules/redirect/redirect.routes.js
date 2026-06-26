/**
 * @file redirect.routes.js
 * @description Express router for the redirect module.
 *
 * Route map
 * ─────────
 *  GET /:shortCode  →  Resolve short code & issue HTTP 302 redirect
 *
 * Middleware stack
 * ────────────────
 *  GET /:shortCode
 *    1. redirectLimiter       – Rate-limit: 100 req / 15 min per IP (production),
 *                               500 req / 15 min in development. Prevents hotlink
 *                               hammering and bot enumeration attacks.
 *    2. validate(params)      – Zod validation of the :shortCode param. Rejects
 *                               malformed codes (path traversal, too short, etc.)
 *                               before any DB / cache work is done.
 *    3. redirectToLongUrl     – Controller: resolve + 302.
 *
 * Design notes
 * ────────────
 *  • No `authenticate` middleware: redirects are always public.
 *  • The route is intentionally mounted at the root path (`/`) in `app.js`
 *    so the final public URL is `<BASE_URL>/:shortCode` with NO `/api/` prefix.
 *    This keeps the short URLs clean, e.g. `http://localhost:4000/aB3kZ`.
 *  • The limiter uses the shared `generalLimiter` pattern but is tuned
 *    specifically for redirect traffic (higher ceiling than write endpoints).
 */

import { Router } from "express";

// Middlewares
import { validate } from "../../middlewares/validate.middleware.js";
import { redirectLimiter } from "../../middlewares/rateLimiter.middleware.js";

// Controller
import { redirectToLongUrl } from "./redirect.controller.js";

// Validation schema
import { redirectParamsSchema } from "./redirect.validation.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /:shortCode
 * @desc   Resolve a short code to its long URL and issue a 302 redirect.
 *         Click metadata (IP, User-Agent, Referer) is captured for analytics.
 * @access Public — no authentication required.
 *
 * @example
 *   curl -I http://localhost:4000/aB3kZ
 *   # HTTP/1.1 302 Found
 *   # Location: https://www.example.com/very/long/url
 */
router.get(
  "/:shortCode",
  redirectLimiter,
  validate(redirectParamsSchema, "params"),
  redirectToLongUrl,
);

export default router;
