/**
 * @file auth.middleware.js
 * @description Authentication / authorization middleware.
 *
 * Verifies Supabase-issued JWTs against the Supabase JWKS endpoint for
 * every protected route.  Invalid or missing tokens receive a 401 response.
 *
 * Exports
 * ───────
 *  `authenticate`  – Requires a valid Bearer JWT.  Attaches `req.user`.
 *                    Use on all routes that need a logged-in user.
 *
 * Token shape attached to `req.user`
 * ────────────────────────────────────
 *  {
 *    id:    string  (Supabase user UUID  – maps to auth.users.id)
 *    email: string
 *    role:  string  (e.g. "authenticated")
 *  }
 *
 * @example
 *   import { authenticate } from '../middlewares/auth.middleware.js';
 *
 *   router.post('/',        authenticate, createLink);
 *   router.get('/',         authenticate, getUserLinks);
 *   router.get('/:id',      authenticate, getLink);
 *   router.patch('/:id',    authenticate, updateLink);
 *   router.delete('/:id',   authenticate, deleteLink);
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { env } from "../configs/env.js";

// ─────────────────────────────────────────────────────────────────────────────
// JWKS setup  (jose caches the key set internally)
// ─────────────────────────────────────────────────────────────────────────────

const JWKS = createRemoteJWKSet(new URL(env.supabaseJwksUrl));

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the Bearer token from the `Authorization` header.
 *
 * @param {import('express').Request} req
 * @returns {string|null} Raw JWT string, or `null` if absent / malformed.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Verify a JWT against Supabase JWKS and return the decoded payload.
 *
 * @param {string} token - Raw JWT string.
 * @returns {Promise<object>} Decoded JWT payload.
 * @throws {ApiError} 401 if the token is invalid or expired.
 */
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${env.supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });
    return payload;
  } catch (err) {
    logger.warn("JWT verification failed", { error: err.message });
    throw new ApiError(401, "Invalid or expired token. Please sign in again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware that REQUIRES a valid Supabase JWT.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT
 * against Supabase JWKS, and attaches the decoded user to `req.user`.
 * Returns 401 if the token is missing, invalid, or expired.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     _res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new ApiError(
        401,
        "Authentication required. Please provide a Bearer token.",
      );
    }

    const payload = await verifyToken(token);

    req.user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}
