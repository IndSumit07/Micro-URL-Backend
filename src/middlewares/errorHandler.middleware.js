/**
 * @file errorHandler.middleware.js
 * @description Global Express error-handling middleware.
 *
 * Catches every error forwarded via `next(error)` from route handlers,
 * normalises it into a consistent JSON envelope, and logs it appropriately.
 *
 * Behaviour
 * ─────────
 *  • ApiError instances → use their own statusCode + message + errors array.
 *  • Zod errors (unexpected)  → 422 with field-level issues.
 *  • All other errors → 500 "Internal Server Error" (details only in dev).
 *  • The full stack trace is always logged server-side via Winston.
 *
 * Response shape:
 * ```json
 * {
 *   "statusCode": 404,
 *   "success": false,
 *   "message": "Link not found.",
 *   "errors": []
 * }
 * ```
 *
 * @example
 *   // Register as the LAST middleware in app.js
 *   app.use(errorHandler);
 */

import { ZodError } from "zod";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

/**
 * Express global error handler.
 *
 * Must have exactly 4 parameters so Express identifies it as an
 * error-handling middleware.
 *
 * @param {Error}                     err  - The thrown error object.
 * @param {import('express').Request} req  - Express request.
 * @param {import('express').Response}res  - Express response.
 * @param {import('express').NextFunction} _next - Unused (required by Express signature).
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Determine status and error details ────────────────────────────────────

  let statusCode = 500;
  let message = "Internal Server Error";
  let errors = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors ?? [];
  } else if (err instanceof ZodError) {
    // Zod errors that leaked past the validate middleware (should be rare)
    statusCode = 422;
    message = "Validation failed.";
    errors = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
  }

  // ── Log ───────────────────────────────────────────────────────────────────

  const logMeta = {
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(err.message, { ...logMeta, stack: err.stack });
  } else {
    logger.warn(err.message, logMeta);
  }

  // ── Respond ───────────────────────────────────────────────────────────────

  const isDev = process.env.NODE_ENV !== "production";

  return res.status(statusCode).json({
    statusCode,
    success: false,
    message,
    errors,
    // Expose stack only in development to avoid leaking internals
    ...(isDev && statusCode >= 500 && { stack: err.stack }),
  });
}
