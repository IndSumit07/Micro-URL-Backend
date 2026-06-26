/**
 * @file redirect.validation.js
 * @description Zod validation schemas for the redirect module.
 *
 * The redirect module has a single external input: the `:shortCode` URL
 * parameter.  We validate it here before the service layer ever sees it,
 * ensuring bad inputs are rejected with a structured 422 response instead
 * of silently falling through to a "not found" database query.
 *
 * Exported schemas
 * ────────────────
 *  `redirectParamsSchema` – Validates `shortCode` route param.
 */

import { z } from "zod";
import { REDIRECT_CONSTRAINTS, REDIRECT_ERRORS } from "./redirect.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for validating the `:shortCode` URL parameter on the redirect route.
 *
 * Rules
 * ─────
 *  • Must be a non-empty string.
 *  • Length must be between SHORT_CODE_MIN_LENGTH and SHORT_CODE_MAX_LENGTH.
 *  • Must consist only of alphanumeric characters, hyphens, and underscores.
 *
 * @type {import('zod').ZodObject}
 *
 * @example
 *   // Valid short codes
 *   "aB3kZ"        ✓
 *   "my-link_01"   ✓
 *
 *   // Invalid short codes
 *   "ab"           ✗  (too short)
 *   "hello world"  ✗  (contains a space)
 *   "../secret"    ✗  (path traversal attempt)
 */
export const redirectParamsSchema = z.object({
  shortCode: z
    .string({ required_error: REDIRECT_ERRORS.INVALID_CODE })
    .trim()
    .min(
      REDIRECT_CONSTRAINTS.SHORT_CODE_MIN_LENGTH,
      `Short code must be at least ${REDIRECT_CONSTRAINTS.SHORT_CODE_MIN_LENGTH} characters.`,
    )
    .max(
      REDIRECT_CONSTRAINTS.SHORT_CODE_MAX_LENGTH,
      `Short code cannot exceed ${REDIRECT_CONSTRAINTS.SHORT_CODE_MAX_LENGTH} characters.`,
    )
    .regex(
      REDIRECT_CONSTRAINTS.SHORT_CODE_PATTERN,
      "Short code may only contain letters, numbers, hyphens, and underscores.",
    ),
});
