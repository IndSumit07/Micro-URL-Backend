/**
 * @file asyncHandler.js
 * @description Higher-order function that wraps async route handlers/middlewares
 * and automatically forwards any thrown errors to Express's `next(error)`.
 *
 * Without this wrapper every async controller would need a manual try/catch.
 * With it, you simply wrap the function and all unhandled promise rejections
 * are caught and routed to the global error-handler middleware.
 *
 * @example
 *   // Before
 *   export async function getLink(req, res, next) {
 *     try { ... } catch(e) { next(e); }
 *   }
 *
 *   // After
 *   export const getLink = asyncHandler(async (req, res) => { ... });
 *
 * @param {Function} fn - An async Express route handler or middleware.
 * @returns {Function} A standard Express middleware that catches async errors.
 */

/**
 * Wraps an async Express route handler to catch rejected promises and forward
 * them to the next error-handling middleware.
 *
 * @param {import('express').RequestHandler} fn - Async handler to wrap.
 * @returns {import('express').RequestHandler}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
