/**
 * @file app.constants.js
 * @description Shared HTTP status code constants.
 *
 * Using named constants instead of raw numbers prevents typos and
 * makes status code intent immediately readable in controllers and
 * middleware.
 *
 * @example
 *   import { HTTP_STATUS } from '../shared/constants/app.constants.js';
 *   res.status(HTTP_STATUS.NOT_FOUND).json(...);
 */

export const HTTP_STATUS = {
  // 2xx — Success
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,

  // 4xx — Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx — Server errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};
