/**
 * @file redirect.service.js
 * @description Business-logic layer for the redirect module.
 *
 * This service is the heart of the URL shortener's core value proposition:
 * given a short code, resolve it to a long URL as fast as possible, then
 * fire off asynchronous side-effects (click tracking) without blocking the
 * response.
 *
 * Responsibilities
 * ────────────────
 *  • Cache-aside lookup: Redis → DB → cache-populate (identical strategy to
 *    links.service.js for consistency)
 *  • Expiry guard: reject links whose `expires_at` is in the past (HTTP 410)
 *  • Click tracking: enqueue a BullMQ job for async click_count increment
 *    (redirect must NOT wait for the DB write)
 *  • Structured logging for every redirect and every queue-enqueue attempt
 *
 * Cache strategy
 * ──────────────
 *  GET /:shortCode
 *    1. Check Redis for `link:code:{shortCode}`
 *    2. On miss → query `links` table by short_code
 *    3. On DB hit → write to Redis (TTL: 24 h)  → return long_url
 *    4. On DB miss → throw 404
 *
 * Click tracking strategy
 * ───────────────────────
 *  After resolving the long URL:
 *    • Enqueue a BullMQ click job (fire-and-forget, never awaited from caller)
 *    • The worker increments `click_count` and (in future) writes analytics rows
 *    • Queue failures are logged as warnings — they never bubble up to the HTTP layer
 *
 * Route → Controller → Service (this file) → Repository / Cache / Queue
 */

import logger from "../../utils/logger.js";
import ApiError from "../../utils/ApiError.js";
import * as cache from "../../utils/cache.js";
import { clickQueue } from "../../queues/click.queue.js";

import * as linkRepository from "../links/links.repository.js";
import { REDIRECT_ERRORS } from "./redirect.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a short code to its destination long URL.
 *
 * Implements a cache-aside (lazy-loading) strategy with an expiry guard.
 * After a successful resolution the click event is queued asynchronously
 * so the caller can issue the HTTP redirect without waiting for a DB write.
 *
 * @param {string} shortCode         - The short code extracted from the URL path.
 * @param {object} [clickContext={}] - Optional metadata about the click event.
 * @param {string} [clickContext.ip]        - Client IP address.
 * @param {string} [clickContext.userAgent] - `User-Agent` header value.
 * @param {string} [clickContext.referer]   - `Referer` header value.
 *
 * @returns {Promise<string>} The resolved long URL the client should be redirected to.
 *
 * @throws {ApiError} 404 if no link exists for the given short code.
 * @throws {ApiError} 410 if the link exists but has expired.
 */
export async function resolveShortCode(shortCode, clickContext = {}) {
  // ── 1. Cache check ───────────────────────────────────────────────────────
  let link = await cache.getLinkByCode(shortCode);

  // ── 2. Cache miss → database ─────────────────────────────────────────────
  if (!link) {
    logger.debug("Cache miss for short code, querying database", { shortCode });

    link = await linkRepository.findByShortCode(shortCode);

    if (!link) {
      logger.warn("Short code not found", { shortCode });
      throw new ApiError(404, REDIRECT_ERRORS.NOT_FOUND);
    }

    // ── 3. Populate cache for subsequent requests ─────────────────────────
    await cache.setLink(link);
    logger.debug("Cache populated from DB", { shortCode, linkId: link.id });
  } else {
    logger.debug("Cache hit for short code", { shortCode, linkId: link.id });
  }

  // ── 4. Expiry guard ───────────────────────────────────────────────────────
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    logger.info("Redirect blocked — link has expired", {
      shortCode,
      linkId: link.id,
      expiredAt: link.expires_at,
    });
    throw new ApiError(410, REDIRECT_ERRORS.EXPIRED);
  }

  // ── 5. Queue the click event (fire-and-forget) ────────────────────────────
  //
  // We deliberately do NOT await this.  The redirect must be sub-50 ms;
  // writing analytics can happen seconds later with no UX impact.
  // Queue failures are swallowed here so a Redis hiccup never breaks redirects.
  enqueueClickEvent(link, clickContext).catch((err) => {
    logger.warn("Failed to enqueue click event — click may not be tracked", {
      shortCode,
      linkId: link.id,
      error: err.message,
    });
  });

  logger.info("Redirect resolved", {
    shortCode,
    linkId: link.id,
    destination: link.long_url,
  });

  return link.long_url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a click-event job to the BullMQ clicks queue.
 *
 * This function is intentionally kept separate from `resolveShortCode` so
 * it can be tested in isolation and called independently if needed.
 *
 * @param {object} link              - The resolved link record.
 * @param {string} link.id           - Link UUID.
 * @param {string} link.short_code   - Short code.
 * @param {object} [clickContext={}] - Click metadata.
 * @param {string} [clickContext.ip]        - Client IP address.
 * @param {string} [clickContext.userAgent] - `User-Agent` header.
 * @param {string} [clickContext.referer]   - `Referer` header.
 * @returns {Promise<void>}
 */
async function enqueueClickEvent(link, clickContext = {}) {
  await clickQueue.add("click", {
    linkId:    link.id,
    shortCode: link.short_code,
    ip:        clickContext.ip        ?? null,
    userAgent: clickContext.userAgent ?? null,
    referer:   clickContext.referer   ?? null,
    timestamp: new Date().toISOString(),
  });

  logger.debug("Click event enqueued", {
    linkId:    link.id,
    shortCode: link.short_code,
  });
}
