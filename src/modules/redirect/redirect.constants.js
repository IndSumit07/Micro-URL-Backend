/**
 * @file redirect.constants.js
 * @description Domain constants for the redirect module.
 *
 * Centralises redirect-specific magic strings and numbers so that
 * the service, controller, and validation schemas all reference the
 * same source of truth.
 *
 * @example
 *   import { REDIRECT_STATUS, REDIRECT_CONSTRAINTS } from './redirect.constants.js';
 */

/**
 * HTTP status codes specifically relevant to redirect operations.
 *
 * 301  Permanent redirect  – cached aggressively by browsers/proxies.
 *                            NOT used here because we need click tracking.
 * 302  Temporary redirect  – default; forces browsers to re-check each visit.
 * 307  Temporary redirect  – like 302 but preserves the HTTP method (POST stays POST).
 */
export const REDIRECT_HTTP_CODE = {
  /** Temporary redirect – every visit hits our server (enables click tracking). */
  FOUND: 302,

  /** Moved Permanently – only use if you are sure the destination never changes. */
  MOVED_PERMANENTLY: 301,

  /** Temporary redirect preserving HTTP method. */
  TEMPORARY_REDIRECT: 307,
};

/**
 * Default redirect behaviour used by the redirect service.
 */
export const REDIRECT_DEFAULTS = {
  /** HTTP status code sent to the client on a successful redirect. */
  STATUS_CODE: REDIRECT_HTTP_CODE.FOUND,
};

/**
 * Constraints for the short code parameter extracted from the URL path.
 */
export const REDIRECT_CONSTRAINTS = {
  /**
   * Minimum length of a short code segment in the URL path.
   * Matches the minimum custom code length in links.constants.js.
   */
  SHORT_CODE_MIN_LENGTH: 3,

  /**
   * Maximum length of a short code segment.
   * Matches the maximum custom code length in links.constants.js.
   */
  SHORT_CODE_MAX_LENGTH: 20,

  /** Allowed characters in a short code (alphanumeric + dash + underscore). */
  SHORT_CODE_PATTERN: /^[A-Za-z0-9_-]+$/,
};

/**
 * Redirect-specific error messages kept in one place so they are easy
 * to change globally without hunting through service/controller code.
 */
export const REDIRECT_ERRORS = {
  NOT_FOUND: "The short link you followed does not exist.",
  EXPIRED: "This short link has expired and is no longer active.",
  INACTIVE: "This short link has been deactivated by its owner.",
  INVALID_CODE: "The short code in the URL is malformed or invalid.",
};
