/**
 * @file ApiResponse.js
 * @description Standardized API response envelope.
 *
 * All successful responses from the API are wrapped in this class so that
 * clients always receive a consistent shape:
 *
 * ```json
 * {
 *   "statusCode": 200,
 *   "success": true,
 *   "message": "Links fetched successfully.",
 *   "data": { ... }
 * }
 * ```
 *
 * @example
 *   res.status(200).json(new ApiResponse(200, links, "Links fetched successfully."));
 *   res.status(201).json(new ApiResponse(201, link, "Short link created successfully."));
 */

class ApiResponse {
  /**
   * @param {number}      statusCode - HTTP status code (e.g. 200, 201).
   * @param {*}           [data]     - Response payload; null for empty responses.
   * @param {string}      [message]  - Human-readable success message.
   */
  constructor(statusCode, data = null, message = "Success") {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;
