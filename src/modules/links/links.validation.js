/**
 * @file links.validation.js
 * @description Zod validation schemas for the links module.
 *
 * All schemas are kept co-located with the module so that field constraints
 * are immediately visible alongside the business logic they protect.
 * Constraints are imported from `links.constants.js` to avoid magic values.
 *
 * Exported schemas
 * ────────────────
 *  `createLinkSchema`  – Validates POST /api/links body.
 *  `updateLinkSchema`  – Validates PATCH /api/links/:id body (all fields optional).
 *  `getLinkParamsSchema` – Validates `id` route param (UUID format).
 *  `getUserLinksQuerySchema` – Validates pagination query params for list endpoints.
 */

import { z } from "zod";
import { LINK_CONSTRAINTS, LINK_STATUS, LINK_QUERY } from "./links.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable field definitions
// ─────────────────────────────────────────────────────────────────────────────

const titleField = z
  .string()
  .trim()
  .max(
    LINK_CONSTRAINTS.TITLE_MAX_LENGTH,
    `Title cannot exceed ${LINK_CONSTRAINTS.TITLE_MAX_LENGTH} characters.`,
  )
  .optional();

const customCodeField = z
  .string()
  .trim()
  .min(
    LINK_CONSTRAINTS.CUSTOM_CODE_MIN_LENGTH,
    `Custom code must be at least ${LINK_CONSTRAINTS.CUSTOM_CODE_MIN_LENGTH} characters.`,
  )
  .max(
    LINK_CONSTRAINTS.CUSTOM_CODE_MAX_LENGTH,
    `Custom code cannot exceed ${LINK_CONSTRAINTS.CUSTOM_CODE_MAX_LENGTH} characters.`,
  )
  .regex(
    LINK_CONSTRAINTS.CUSTOM_CODE_PATTERN,
    "Only letters, numbers, hyphens, and underscores are allowed.",
  )
  .optional();

const expiresAtField = z
  .string()
  .datetime({ message: "expiresAt must be a valid ISO 8601 datetime string." })
  .refine(
    (val) => new Date(val) > new Date(),
    "Expiry date must be in the future.",
  )
  .optional();

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for creating a new short link.
 *
 * Required fields : `longUrl`
 * Optional fields : `title`, `customCode`, `expiresAt`
 *
 * @type {import('zod').ZodObject}
 */
export const createLinkSchema = z.object({
  longUrl: z
    .string({ required_error: "longUrl is required." })
    .trim()
    .url("longUrl must be a valid URL (include https://)."),

  title: titleField,
  customCode: customCodeField,
  expiresAt: expiresAtField,
});

/**
 * Schema for updating an existing link.
 *
 * All fields are optional – the client sends only the fields it wants
 * to change.  At least one field must be provided.
 *
 * @type {import('zod').ZodObject}
 */
export const updateLinkSchema = z
  .object({
    title: titleField,
    expiresAt: expiresAtField,
    // TODO: Uncomment once 'status' column is added to the links table in Supabase
    // status: z
    //   .enum(Object.values(LINK_STATUS), {
    //     errorMap: () => ({
    //       message: `Status must be one of: ${Object.values(LINK_STATUS).join(", ")}.`,
    //     }),
    //   })
    //   .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

/**
 * Schema for validating the `:id` route parameter.
 *
 * @type {import('zod').ZodObject}
 */
export const getLinkParamsSchema = z.object({
  id: z.string().uuid("Link ID must be a valid UUID."),
});

/**
 * Schema for validating pagination query params on the user-links list.
 *
 * @type {import('zod').ZodObject}
 */
export const getUserLinksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : LINK_QUERY.PAGE_DEFAULT))
    .pipe(z.number().int().min(1, "Page must be a positive integer.")),

  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : LINK_QUERY.LIMIT_DEFAULT))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(
          LINK_QUERY.LIMIT_MAX,
          `Limit cannot exceed ${LINK_QUERY.LIMIT_MAX}.`,
        ),
    ),
});
