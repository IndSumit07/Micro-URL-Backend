/**
 * @file links.controller.js
 * @description HTTP layer for the links module.
 *
 * Controllers are intentionally thin: they extract request data, call the
 * service layer, and return a standardised `ApiResponse`.  All business
 * logic lives in `links.service.js`.
 *
 * Route → Controller → Service → Repository → DB
 *
 * Every handler is wrapped with `asyncHandler` so unhandled promise
 * rejections are automatically forwarded to the global error handler.
 *
 * Endpoints handled
 * ─────────────────
 *  POST   /api/links           → createLink
 *  GET    /api/links           → getUserLinks
 *  GET    /api/links/:id       → getLink
 *  PATCH  /api/links/:id       → updateLink
 *  DELETE /api/links/:id       → deleteLink
 *  GET    /api/links/count     → getLinkCount
 */

import * as linkService from "./links.service.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { HTTP_STATUS } from "../../shared/constants/app.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new short link.
 *
 * Accepts an optional authenticated user so that guests can also create
 * anonymous (unowned) links.
 *
 * @route  POST /api/links
 * @access Public (optionalAuth)
 *
 * @param {import('express').Request}  req      - Validated body: { longUrl, title?, customCode?, expiresAt? }
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {ApiResponse<object>} 201 with the created link object (includes `short_url`).
 */
export const createLink = asyncHandler(async (req, res) => {
  const { longUrl, title, customCode, expiresAt } = req.body;
  const userId = req.user?.id ?? null;

  const link = await linkService.createShortLink({
    longUrl,
    title,
    userId,
    customCode,
    expiresAt,
  });

  return res
    .status(HTTP_STATUS.CREATED)
    .json(new ApiResponse(HTTP_STATUS.CREATED, link, "Short link created successfully."));
});

/**
 * Get all links belonging to the authenticated user.
 *
 * Supports pagination via `?page=1&limit=20` query parameters.
 *
 * @route  GET /api/links
 * @access Private (authenticate)
 *
 * @param {import('express').Request}  req - `req.user.id` is the owner UUID.
 *   Query: { page?: number, limit?: number } (validated by schema).
 * @param {import('express').Response} res
 * @returns {ApiResponse<object[]>} 200 with an array of link objects.
 */
export const getUserLinks = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit } = req.query;

  const links = await linkService.getUserLinks(userId, { page, limit });

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, links, "Links fetched successfully."));
});

/**
 * Get a single link by its UUID.
 *
 * @route  GET /api/links/:id
 * @access Private (authenticate)
 *
 * @param {import('express').Request}  req - `req.params.id` is the link UUID.
 * @param {import('express').Response} res
 * @returns {ApiResponse<object>} 200 with the link object.
 */
export const getLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const link = await linkService.getLinkById(id, userId);

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, link, "Link fetched successfully."));
});

/**
 * Update mutable fields on an existing link.
 *
 * @route  PATCH /api/links/:id
 * @access Private (authenticate)
 *
 * @param {import('express').Request}  req - `req.params.id` link UUID;
 *   validated body: { title?, expiresAt?, status? }.
 * @param {import('express').Response} res
 * @returns {ApiResponse<object>} 200 with the updated link object.
 */
export const updateLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const updatedLink = await linkService.updateLink(id, req.body, userId);

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, updatedLink, "Link updated successfully."));
});

/**
 * Permanently delete a link.
 *
 * @route  DELETE /api/links/:id
 * @access Private (authenticate)
 *
 * @param {import('express').Request}  req - `req.params.id` link UUID.
 * @param {import('express').Response} res
 * @returns {ApiResponse<null>} 200 with null data on success.
 */
export const deleteLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await linkService.deleteLink(id, userId);

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, null, "Link deleted successfully."));
});

/**
 * Get the total count of links for the authenticated user.
 *
 * Useful for dashboard stats widgets.
 *
 * @route  GET /api/links/count
 * @access Private (authenticate)
 *
 * @param {import('express').Request}  req - `req.user.id` owner UUID.
 * @param {import('express').Response} res
 * @returns {ApiResponse<{ count: number }>} 200 with the count.
 */
export const getLinkCount = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const count = await linkService.getLinkCount(userId);

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, { count }, "Link count fetched successfully."));
});
