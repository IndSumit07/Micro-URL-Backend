/**
 * @file cache.js
 * @description Redis-backed cache utility for the links service.
 *
 * Provides a thin abstraction over the raw `ioredis` client so that cache
 * operations are:
 *   - Documented with clear param/return contracts
 *   - Resilient (errors are logged but never thrown, so a Redis outage
 *     degrades gracefully rather than crashing the request)
 *   - Key-namespaced via shared constants
 *
 * Key Schema
 * ──────────
 *   link:{id}            → single link object (by DB primary key)
 *   link:code:{code}     → single link object (by short code)
 *   link:user:{userId}   → array of link objects for a user
 *
 * @example
 *   import * as cache from '../../utils/cache.js';
 *
 *   await cache.setLink(link);
 *   const cached = await cache.getLinkById(id);
 *   await cache.invalidateLink(id, shortCode, userId);
 */

import redis from "../configs/redis.js";
import logger from "./logger.js";
import { REDIS_KEYS, CACHE_TTL } from "../shared/constants/redis.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Key builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Redis key for a link by its primary-key ID.
 *
 * @param {string} id - Link UUID.
 * @returns {string}  Redis key, e.g. `link:abc-123`.
 */
export const buildLinkKey = (id) => `${REDIS_KEYS.LINK}:${id}`;

/**
 * Build the Redis key for a link by its short code.
 *
 * @param {string} code - Short code string.
 * @returns {string}    Redis key, e.g. `link:code:aB3kZ`.
 */
export const buildLinkCodeKey = (code) => `${REDIS_KEYS.LINK}:code:${code}`;

/**
 * Build the Redis key for a user's link collection.
 *
 * @param {string} userId - User UUID.
 * @returns {string}      Redis key, e.g. `link:user:user-uuid`.
 */
export const buildUserLinksKey = (userId) =>
  `${REDIS_KEYS.LINK}:user:${userId}`;

// ─────────────────────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve a cached link by its primary-key ID.
 *
 * @param {string}           id  - Link UUID.
 * @returns {Promise<object|null>} Parsed link object, or `null` on miss/error.
 */
export async function getLinkById(id) {
  try {
    const raw = await redis.get(buildLinkKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn("Cache read failed (getLinkById)", { id, error: err.message });
    return null;
  }
}

/**
 * Retrieve a cached link by its short code.
 *
 * @param {string}           code - Short code string.
 * @returns {Promise<object|null>} Parsed link object, or `null` on miss/error.
 */
export async function getLinkByCode(code) {
  try {
    const raw = await redis.get(buildLinkCodeKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn("Cache read failed (getLinkByCode)", {
      code,
      error: err.message,
    });
    return null;
  }
}

/**
 * Retrieve a cached array of links for a given user.
 *
 * @param {string}           userId - User UUID.
 * @returns {Promise<Array|null>}   Parsed array of links, or `null` on miss/error.
 */
export async function getUserLinks(userId) {
  try {
    const raw = await redis.get(buildUserLinksKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn("Cache read failed (getUserLinks)", {
      userId,
      error: err.message,
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache a link object under both its ID key and its short-code key.
 *
 * @param {object} link                       - Link record from the database.
 * @param {string} link.id                    - Link UUID.
 * @param {string} link.short_code            - Short code string.
 * @param {number} [ttl=CACHE_TTL.LINK]       - TTL in seconds.
 * @returns {Promise<void>}
 */
export async function setLink(link, ttl = CACHE_TTL.LINK) {
  try {
    const value = JSON.stringify(link);
    await Promise.all([
      redis.set(buildLinkKey(link.id), value, "EX", ttl),
      redis.set(buildLinkCodeKey(link.short_code), value, "EX", ttl),
    ]);
  } catch (err) {
    logger.warn("Cache write failed (setLink)", {
      id: link.id,
      error: err.message,
    });
  }
}

/**
 * Cache an array of links for a user.
 *
 * @param {string} userId                     - User UUID.
 * @param {Array}  links                      - Array of link records.
 * @param {number} [ttl=CACHE_TTL.DASHBOARD]  - TTL in seconds.
 * @returns {Promise<void>}
 */
export async function setUserLinks(userId, links, ttl = CACHE_TTL.DASHBOARD) {
  try {
    await redis.set(
      buildUserLinksKey(userId),
      JSON.stringify(links),
      "EX",
      ttl,
    );
  } catch (err) {
    logger.warn("Cache write failed (setUserLinks)", {
      userId,
      error: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invalidation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate all cache keys associated with a link.
 *
 * Deletes the ID key, the short-code key, and (if a userId is provided)
 * the user's link-collection key so that stale lists are not served.
 *
 * @param {string}      id        - Link UUID.
 * @param {string}      shortCode - Short code string.
 * @param {string|null} [userId]  - Optional user UUID to also bust the user list.
 * @returns {Promise<void>}
 */
export async function invalidateLink(id, shortCode, userId = null) {
  try {
    const keys = [buildLinkKey(id), buildLinkCodeKey(shortCode)];
    if (userId) keys.push(buildUserLinksKey(userId));
    await redis.del(...keys);
  } catch (err) {
    logger.warn("Cache invalidation failed (invalidateLink)", {
      id,
      error: err.message,
    });
  }
}
