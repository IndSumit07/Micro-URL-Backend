/**
 * @file ApiError.js
 * @description Custom operational error class for the API.
 *
 * Extends the native `Error` class to include an HTTP status code, a
 * structured errors array for field-level validation messages, and an
 * optional data payload.  Thrown in service / controller layers and caught
 * by the global error handler middleware.
 *
 * @example
 *   throw new ApiError(404, "Link not found.");
 *   throw new ApiError(422, "Validation failed.", [{ field: "longUrl", message: "Required" }]);
 */

class ApiError extends Error {
  /**
   * @param {number}   statusCode - HTTP status code (e.g. 400, 404, 500).
   * @param {string}   [message]  - Human-readable error description.
   * @param {Array}    [errors]   - Optional array of structured field errors.
   * @param {string}   [stack]    - Optional custom stack trace string.
   */
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = "",
  ) {
    super(message);

    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
