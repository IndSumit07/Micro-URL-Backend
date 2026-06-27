/**
 * @file redirect.controller.js
 * @description HTTP layer for the redirect module.
 */

import * as redirectService from "./redirect.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { REDIRECT_DEFAULTS } from "./redirect.constants.js";

export const redirectToLongUrl = asyncHandler(async (req, res) => {
  const { shortCode } = req.params;
  const requestStart = Date.now();

  const clickContext = {
    ip:        req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.headers["user-agent"]  ?? null,
    referer:   req.headers["referer"]     ?? req.headers["referrer"] ?? null,
    requestStart,
  };

  const longUrl = await redirectService.resolveShortCode(shortCode, clickContext);

  return res.redirect(REDIRECT_DEFAULTS.STATUS_CODE, longUrl);
});
