/**
 * @file shortCode.js
 * @description URL short-code generation utility.
 *
 * Uses `nanoid` with a custom, ambiguity-free alphabet (no 0/O, 1/l/I
 * confusion) to generate compact, URL-safe short codes.
 *
 * The alphabet and length are driven by shared constants so that a single
 * change propagates everywhere.
 *
 * @example
 *   import { generateShortCode } from '../utils/shortCode.js';
 *
 *   const code = generateShortCode();        // → e.g. "aB3kZ"  (5 chars)
 *   const long  = generateShortCode(8);      // → e.g. "aB3kZx9P" (8 chars)
 */

import { customAlphabet } from "nanoid";
import { SHORT_CODE } from "../shared/constants/shortCode.constants.js";

const ALPHABET = SHORT_CODE.ALPHABET;
const DEFAULT_LENGTH = SHORT_CODE.LENGTH;

/**
 * Generate a random short code string.
 *
 * @param {number} [length=DEFAULT_LENGTH] - Desired code length. Defaults to
 *   the value in `shortCode.constants.js` (currently 5).
 * @returns {string} A URL-safe, random short code.
 */
export function generateShortCode(length = DEFAULT_LENGTH) {
  return customAlphabet(ALPHABET, length)();
}
