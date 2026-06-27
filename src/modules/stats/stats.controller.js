/**
 * @file stats.controller.js
 * @description Public platform stats — no authentication required.
 * Calls the Supabase `get_public_stats` RPC and returns the result.
 */

import supabase from "../../configs/supabase.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { HTTP_STATUS } from "../../shared/constants/app.constants.js";

export const getPublicStats = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.rpc("get_public_stats");

  if (error) {
    // Fallback to direct queries if RPC fails
    const [clicksRes, linksRes, avgRes] = await Promise.all([
      supabase.from("links").select("click_count"),
      supabase.from("links").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("clicks").select("redirect_ms").not("redirect_ms", "is", null).gt("redirect_ms", 0).lt("redirect_ms", 5000),
    ]);

    const totalClicks = (clicksRes.data || []).reduce((s, r) => s + (r.click_count || 0), 0);
    const activeLinks = linksRes.count || 0;
    const avgRedirectMs = avgRes.data?.length
      ? Math.round(avgRes.data.reduce((s, r) => s + r.redirect_ms, 0) / avgRes.data.length)
      : null;

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, { total_clicks: totalClicks, active_links: activeLinks, avg_redirect_ms: avgRedirectMs }, "Stats fetched.")
    );
  }

  return res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, data, "Stats fetched.")
  );
});
