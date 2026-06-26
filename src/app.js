/**
 * @file app.js
 * @description Express application factory.
 *
 * Sets up the full middleware stack in order:
 *  1. Security  → Helmet (HTTP headers hardening)
 *  2. CORS      → Cross-origin resource sharing
 *  3. Logging   → Morgan HTTP request logger (dev format in development)
 *  4. Parsing   → JSON & URL-encoded body parsers
 *  5. Rate limiting → Global API limiter applied to all /api routes
 *  6. Routes    → Health check + all module routers
 *  7. 404 handler → Unmatched routes
 *  8. Error handler → Global error normalisation (must be last)
 *
 * @example
 *   // server.js
 *   import app from './src/app.js';
 *   app.listen(4000);
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";

import linksRouter from "./modules/links/links.routes.js";
import redirectRouter from "./modules/redirect/redirect.routes.js";

import ApiError from "./utils/ApiError.js";
import { HTTP_STATUS } from "./shared/constants/app.constants.js";

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Security middleware
// ─────────────────────────────────────────────────────────────────────────────

/** Set security-related HTTP headers (Content-Security-Policy, X-Frame-Options, etc.) */
app.use(helmet());

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allow cross-origin requests.
 * TODO: Replace `origin: *` with a whitelist before going to production.
 */
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL || false
      : "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. HTTP request logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Morgan logs every HTTP request.
 * `dev` format in development; `combined` (Apache-style) in production.
 */
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Body parsers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse incoming JSON bodies (max 1 MB to prevent request flooding) */
app.use(express.json({ limit: "1mb" }));

/** Parse URL-encoded bodies (HTML form submissions) */
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─────────────────────────────────────────────────────────────────────────────
// 5. Global rate limiter
// ─────────────────────────────────────────────────────────────────────────────

/** Apply a broad rate limit to all /api/* routes */
app.use("/api", generalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Routes
// ─────────────────────────────────────────────────────────────────────────────

/** Health-check endpoint — no auth, no rate limiting */
app.get("/api/health", (_req, res) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Server is healthy.",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
  });
});

/** Links module */
app.use("/api/links", linksRouter);

/**
 * Redirect module — mounted at root so short URLs resolve as:
 *   GET <BASE_URL>/:shortCode  →  302 <long_url>
 *
 * ⚠️  This router MUST be registered AFTER all /api routes.
 *    Express matches routes top-to-bottom; mounting it here ensures the
 *    wildcard `/:shortCode` parameter never intercepts /api/* traffic.
 */
app.use("/", redirectRouter);

// ─────────────────────────────────────────────────────────────────────────────
// 7. 404 handler (must come after all valid routes)
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  next(
    new ApiError(
      HTTP_STATUS.NOT_FOUND,
      `Cannot ${req.method} ${req.originalUrl}`,
    ),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Global error handler (must be LAST, 4-arg signature required by Express)
// ─────────────────────────────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
