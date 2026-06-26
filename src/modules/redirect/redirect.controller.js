/**
 * @file redirect.controller.js
 * @description HTTP layer for the redirect module.
 *
 * Controllers are intentionally thin: extract the short code from the URL,
 * build a click-context object from request headers, call the service, and
 * issue the HTTP redirect.  All resolution logic lives in `redirect.service.js`.
 *
 * Route → Controller → Service → Cache / Repository / Queue
 *
 * Every handler is wrapped with `asyncHandler` so unhandled promise
 * rejections are forwarded to the global error handler automatically.
 *
 * Endpoints handled
 * ─────────────────
 *  GET /:shortCode  → redirectToLongUrl
 *
 * HTTP response behaviour
 * ───────────────────────
 *  Success (link found & not expired)  → 302 Location: <long_url>
 *  Not found                           → 404  (handled by global error handler)
 *  Expired link                        → 410  (handled by global error handler)
 *  Malformed short code                → 422  (Zod validation, before controller runs)
 */

import * as redirectService from "./redirect.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { REDIRECT_DEFAULTS } from "./redirect.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a short code and issue an HTTP redirect to the destination long URL.
 *
 * Click context (IP, User-Agent, Referer) is extracted from the request and
 * passed to the service layer which enqueues it for async analytics processing.
 * The controller does NOT wait for the queue enqueue — it calls `res.redirect`
 * as soon as the long URL is resolved.
 *
 * @route  GET /:shortCode
 * @access Public (no authentication required)
 *
 * @param {import('express').Request}  req  - `req.params.shortCode` is the short code.
 * @param {import('express').Response} res
 * @returns {void} Issues a 302 redirect; does not return a JSON body.
 */
export const redirectToLongUrl = asyncHandler(async (req, res) => {
  const { shortCode } = req.params;

  // Build click context from request headers for analytics
  const clickContext = {
    ip:        req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.headers["user-agent"]  ?? null,
    referer:   req.headers["referer"]     ?? req.headers["referrer"] ?? null,
  };

  // Resolve the short code to a long URL (throws ApiError on 404 / 410)
  const longUrl = await redirectService.resolveShortCode(shortCode, clickContext);

  // Issue the HTTP redirect — no JSON body, just headers
  return res.redirect(REDIRECT_DEFAULTS.STATUS_CODE, longUrl);
});
