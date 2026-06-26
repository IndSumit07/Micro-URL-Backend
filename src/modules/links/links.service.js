/**
 * @file links.service.js
 * @description Business-logic layer for the links module.
 *
 * The service sits between controllers and the repository.  It:
 *  • Enforces business rules (uniqueness checks, ownership guards, etc.)
 *  • Orchestrates multi-step operations (generate → check → insert loop)
 *  • Manages the Redis cache (read-through / write-through / invalidation)
 *  • Constructs the final short URL using the configured BASE_URL
 *
 * Controllers call service functions directly; service functions call
 * repository functions and the cache utility.  No HTTP concerns belong here.
 *
 * Cache strategy
 * ──────────────
 *  GET  → check cache → on miss: hit DB → populate cache → return
 *  POST → insert DB   → populate cache → return
 *  PATCH→ update DB   → invalidate old cache → populate new cache → return
 *  DEL  → delete DB   → invalidate cache → return
 */

import { env } from "../../configs/env.js";
import { generateShortCode } from "../../utils/shortCode.js";
import ApiError from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";
import * as cache from "../../utils/cache.js";

import * as linkRepository from "./links.repository.js";
import { LINK_STATUS } from "./links.constants.js";

import { SHORT_CODE } from "../../shared/constants/shortCode.constants.js";
import { DATABASE_ERRORS } from "../../shared/constants/database.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append the full short URL to a link record so clients receive a ready-to-use URL.
 *
 * @param {object} link            - Raw link record from the database.
 * @param {string} link.short_code - The short code to append.
 * @returns {object} Link record with an added `short_url` field.
 */
function withShortUrl(link) {
  return {
    ...link,
    short_url: `${env.baseUrl}/${link.short_code}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new short link.
 *
 * Handles two paths:
 *  1. Custom code supplied  → checks for collision → inserts.
 *  2. No custom code        → auto-generates until unique (up to MAX_RETRIES).
 *
 * On success the new link is written to cache and returned with `short_url`.
 *
 * @param {object}      payload              - Creation payload.
 * @param {string}      payload.longUrl      - Original URL to shorten.
 * @param {string}      [payload.title]      - Optional human-readable title.
 * @param {string|null} [payload.userId]     - Owner user UUID (null for guests).
 * @param {string}      [payload.customCode] - Optional desired short code.
 * @param {string}      [payload.expiresAt]  - Optional ISO expiry datetime.
 * @returns {Promise<object>} The created link record with `short_url`.
 * @throws {ApiError} 409 if the custom code is already taken.
 * @throws {ApiError} 500 if auto-generation exhausts all retries.
 */
export async function createShortLink({
  longUrl,
  title,
  userId,
  customCode,
  expiresAt,
}) {
  const basePayload = {
    long_url: longUrl,
    title: title ?? null,
    user_id: userId,
    expires_at: expiresAt ?? null,
    // NOTE: `status` omitted — DB column doesn't exist yet.
    // Add: status: LINK_STATUS.ACTIVE  once the column is created in Supabase.
  };

  // ── Path 1: Custom short code ─────────────────────────────────────────────
  if (customCode) {
    const existingLink = await linkRepository.findByShortCode(customCode);

    if (existingLink) {
      throw new ApiError(
        409,
        `The custom short code "${customCode}" is already in use. Please choose a different one.`,
      );
    }

    const link = await linkRepository.createLink({
      ...basePayload,
      short_code: customCode,
    });

    await cache.setLink(link);
    logger.info("Short link created (custom code)", {
      id: link.id,
      code: link.short_code,
    });

    return withShortUrl(link);
  }

  // ── Path 2: Auto-generated short code ────────────────────────────────────
  for (let attempt = 1; attempt <= SHORT_CODE.MAX_RETRIES; attempt++) {
    const shortCode = generateShortCode();

    try {
      const link = await linkRepository.createLink({
        ...basePayload,
        short_code: shortCode,
      });

      await cache.setLink(link);
      logger.info("Short link created (auto code)", {
        id: link.id,
        code: link.short_code,
        attempt,
      });

      return withShortUrl(link);
    } catch (error) {
      if (error.code === DATABASE_ERRORS.UNIQUE_VIOLATION) {
        logger.debug("Short code collision, retrying…", { shortCode, attempt });
        continue;
      }
      throw error;
    }
  }

  throw new ApiError(
    500,
    "Failed to generate a unique short URL after multiple attempts. Please try again.",
  );
}

/**
 * Retrieve a link by its short code (used by the redirect module).
 *
 * Implements a cache-aside (lazy-loading) strategy:
 *  1. Check Redis cache.
 *  2. On miss, query database.
 *  3. Populate cache for future requests.
 *
 * @param {string} shortCode - The short code to look up.
 * @returns {Promise<object>} Link record with `short_url`.
 * @throws {ApiError} 404 if no link matches the short code.
 * @throws {ApiError} 410 if the link has expired.
 */
export async function getLinkByShortCode(shortCode) {
  // 1. Cache check
  let link = await cache.getLinkByCode(shortCode);

  // 2. Cache miss → database
  if (!link) {
    link = await linkRepository.findByShortCode(shortCode);

    if (!link) {
      throw new ApiError(404, "Short link not found.");
    }

    await cache.setLink(link);
  }

  // 3. Expiry guard
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new ApiError(410, "This short link has expired.");
  }

  return withShortUrl(link);
}

/**
 * Retrieve a link by its primary-key UUID (used by the management API).
 *
 * Implements cache-aside: cache → DB on miss → repopulate cache.
 *
 * @param {string} id     - Link UUID.
 * @param {string} userId - Requesting user's UUID (for ownership enforcement in production).
 * @returns {Promise<object>} Link record with `short_url`.
 * @throws {ApiError} 404 if the link does not exist.
 */
export async function getLinkById(id, userId) {
  // 1. Cache check
  let link = await cache.getLinkById(id);

  // 2. Cache miss → database
  if (!link) {
    link = await linkRepository.findById(id);

    if (!link) {
      throw new ApiError(404, "Link not found.");
    }

    await cache.setLink(link);
  }

  // 3. Ownership guard — 404 instead of 403 to avoid information disclosure
  if (link.user_id && link.user_id !== userId) {
    throw new ApiError(404, "Link not found.");
  }

  return withShortUrl(link);
}

/**
 * Retrieve all links belonging to a user with optional pagination.
 *
 * @param {string} userId            - Owner user UUID.
 * @param {object} [pagination]      - Pagination options.
 * @param {number} [pagination.page=1]  - 1-based page number.
 * @param {number} [pagination.limit=20] - Records per page.
 * @returns {Promise<object[]>} Array of link records (each with `short_url`).
 */
export async function getUserLinks(userId, pagination = {}) {
  // User-list cache is intentionally short-TTL; bypass cache on page > 1
  if (!pagination.page || pagination.page === 1) {
    const cached = await cache.getUserLinks(userId);
    if (cached) return cached.map(withShortUrl);
  }

  const links = await linkRepository.findByUserId(userId, pagination);
  const withUrls = links.map(withShortUrl);

  // Only cache page 1 (the most commonly requested)
  if (!pagination.page || pagination.page === 1) {
    await cache.setUserLinks(userId, links);
  }

  return withUrls;
}

/**
 * Update an existing link's mutable fields.
 *
 * Only the calling user's own links may be updated.  The service maps
 * camelCase request fields to snake_case database columns.
 *
 * @param {string} id      - Link UUID to update.
 * @param {object} updates - Partial update payload (camelCase from controller).
 * @param {string} [updates.title]     - New title.
 * @param {string} [updates.expiresAt] - New ISO expiry datetime.
 * @param {string} [updates.status]    - New status value.
 * @param {string} userId  - Requesting user's UUID.
 * @returns {Promise<object>} Updated link record with `short_url`.
 * @throws {ApiError} 404 if the link does not exist or doesn't belong to the user.
 */
export async function updateLink(id, updates, userId) {
  const existingLink = await linkRepository.findById(id);

  if (!existingLink) {
    throw new ApiError(404, "Link not found.");
  }

  // Ownership guard — 404 instead of 403 to avoid information disclosure
  if (existingLink.user_id && existingLink.user_id !== userId) {
    throw new ApiError(404, "Link not found.");
  }

  // Map camelCase → snake_case for DB columns
  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;
  // TODO: Uncomment once 'status' column is added to the links table in Supabase
  // if (updates.status !== undefined) dbUpdates.status = updates.status;

  const updatedLink = await linkRepository.updateLink(id, dbUpdates);

  // Invalidate stale cache entries
  await cache.invalidateLink(
    existingLink.id,
    existingLink.short_code,
    existingLink.user_id,
  );

  // Write updated record to cache
  await cache.setLink(updatedLink);

  logger.info("Link updated", { id, updates: dbUpdates });

  return withShortUrl(updatedLink);
}

/**
 * Delete a link permanently.
 *
 * @param {string} id     - Link UUID to delete.
 * @param {string} userId - Requesting user's UUID.
 * @returns {Promise<void>}
 * @throws {ApiError} 404 if the link does not exist or doesn't belong to the user.
 */
export async function deleteLink(id, userId) {
  const existingLink = await linkRepository.findById(id);

  if (!existingLink) {
    throw new ApiError(404, "Link not found.");
  }

  // Ownership guard — 404 instead of 403 to avoid information disclosure
  if (existingLink.user_id && existingLink.user_id !== userId) {
    throw new ApiError(404, "Link not found.");
  }

  await linkRepository.deleteLink(id);

  // Purge all cache entries for this link
  await cache.invalidateLink(
    existingLink.id,
    existingLink.short_code,
    existingLink.user_id,
  );

  logger.info("Link deleted", { id, userId });
}

/**
 * Retrieve the total number of links a user has created.
 *
 * @param {string} userId - Owner user UUID.
 * @returns {Promise<number>} Total link count for the user.
 */
export async function getLinkCount(userId) {
  return linkRepository.countByUserId(userId);
}
