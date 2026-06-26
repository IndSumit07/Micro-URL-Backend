/**
 * @file validate.middleware.js
 * @description Zod-powered request validation middleware factory.
 *
 * `validate(schema, source?)` returns an Express middleware that parses and
 * validates the specified part of the request against a Zod schema.  On
 * success the parsed (and coerced) data replaces the original source so
 * downstream handlers always receive clean, typed values.  On failure it
 * forwards a structured 422 ApiError to the global error handler.
 *
 * @example
 *   import { validate } from '../middlewares/validate.middleware.js';
 *   import { createLinkSchema } from '../modules/links/links.validation.js';
 *
 *   router.post('/', validate(createLinkSchema), createLink);
 *   router.put('/:id', validate(updateLinkSchema), updateLink);
 */

import ApiError from "../utils/ApiError.js";

/**
 * Factory that returns a validation middleware for the given Zod schema.
 *
 * @param {import('zod').ZodSchema} schema      - Zod schema to validate against.
 * @param {'body'|'query'|'params'} [source='body'] - Which part of `req` to validate.
 * @returns {import('express').RequestHandler}  Express middleware.
 */
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Map Zod issues to a flat array of { field, message } objects
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new ApiError(422, "Validation failed.", errors));
    }

    // Replace raw request data with the Zod-parsed (coerced/stripped) version
    req[source] = result.data;
    return next();
  };
}
