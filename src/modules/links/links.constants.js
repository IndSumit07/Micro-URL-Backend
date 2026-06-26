/**
 * @file links.constants.js
 * @description Domain constants for the links module.
 *
 * Centralises magic strings and numbers so that validation schemas,
 * service logic, and controller responses all reference the same source
 * of truth.
 *
 * @example
 *   import { LINK_CONSTRAINTS, LINK_STATUS } from './links.constants.js';
 *
 *   if (link.status === LINK_STATUS.ACTIVE) { ... }
 */

/**
 * Field-level constraints for link data.
 * Used in both the Zod validation schema and the database layer.
 */
export const LINK_CONSTRAINTS = {
  /** Maximum characters allowed in the `title` field */
  TITLE_MAX_LENGTH: 100,

  /** Minimum characters required for a custom short code */
  CUSTOM_CODE_MIN_LENGTH: 3,

  /** Maximum characters allowed for a custom short code */
  CUSTOM_CODE_MAX_LENGTH: 20,

  /** Regex a custom short code must satisfy (alphanumeric + _ -) */
  CUSTOM_CODE_PATTERN: /^[A-Za-z0-9_-]+$/,
};

/**
 * Possible values for the `status` field on a link record.
 */
export const LINK_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
};

/**
 * Query string keys used when listing / filtering links.
 */
export const LINK_QUERY = {
  PAGE_DEFAULT: 1,
  LIMIT_DEFAULT: 20,
  LIMIT_MAX: 100,
};
