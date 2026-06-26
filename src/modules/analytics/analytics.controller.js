import * as analyticsService from "./analytics.service.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { HTTP_STATUS } from "../../shared/constants/app.constants.js";

export const getOverview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const days = parseInt(req.query.days || "7", 10);
  
  let linkIds = req.query.linkIds;
  if (typeof linkIds === "string") {
    linkIds = linkIds.split(",").filter(Boolean);
  }

  const stats = await analyticsService.getDashboardAnalytics(userId, days, linkIds);

  return res
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, stats, "Analytics fetched successfully."));
});
