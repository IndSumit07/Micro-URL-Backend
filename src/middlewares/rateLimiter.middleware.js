/**
 * @file rateLimiter.middleware.js
 * @description Configurable rate-limiter middlewares using `express-rate-limit`.
 *
 * Three presets are exported, each tuned for a different concern:
 *
 * | Export              | Window   | Max Requests | Intended use                         |
 * |---------------------|----------|--------------|--------------------------------------|
 * | `generalLimiter`    | 15 min   | 200          | All API routes (global safety net)   |
 * | `createLinkLimiter` | 15 min   | 30           | POST /api/links (write-heavy guard)  |
 * | `strictLimiter`     | 15 min   | 10           | Sensitive endpoints (future auth ops)|
 *
 * In development the limiters still run (so you can observe their behaviour)
 * but with relaxed limits and a verbose debug header so it's never a pain.
 *
 * @example
 *   import { generalLimiter, createLinkLimiter } from '../middlewares/rateLimiter.middleware.js';
 *
 *   // Apply globally in app.js
 *   app.use('/api', generalLimiter);
 *
 *   // Apply narrowly on the create-link route
 *   router.post('/', createLinkLimiter, validate(createLinkSchema), createLink);
 */

import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

const isDev = process.env.NODE_ENV !== "production";

// ─────────────────────────────────────────────────────────────────────────────
// Shared handler factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a standardised rate-limit exceeded handler.
 *
 * @param {string} scope - Human-readable label for log messages.
 * @returns {import('express-rate-limit').RateLimitExceededEventHandler}
 */
function makeHandler(scope) {
  return (req, res) => {
    logger.warn(`Rate limit exceeded [${scope}]`, {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
    });

    return res.status(429).json({
      statusCode: 429,
      success: false,
      message: "Too many requests. Please slow down and try again later.",
      errors: [],
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Limiters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * General rate limiter – applied to every `/api/*` route.
 *
 * Limits each IP to 200 requests per 15-minute window.
 * In development the window is relaxed to 500 requests.
 *
 * @type {import('express').RequestHandler}
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutes
  max: isDev ? 500 : 200,
  standardHeaders: true,           // Return `RateLimit-*` headers
  legacyHeaders: false,
  handler: makeHandler("general"),
});

/**
 * Create-link rate limiter – applied specifically to POST /api/links.
 *
 * Limits each IP to 30 link-creation requests per 15 minutes to prevent
 * spam and abuse of the shortener.
 * In development the limit is set to 100 to avoid friction.
 *
 * @type {import('express').RequestHandler}
 */
export const createLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("create-link"),
});

/**
 * Strict rate limiter – for sensitive endpoints (auth flows, admin ops).
 *
 * Limits each IP to 10 requests per 15 minutes.
 * In development the limit is relaxed to 50.
 *
 * @type {import('express').RequestHandler}
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("strict"),
});
