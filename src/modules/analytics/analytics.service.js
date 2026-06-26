import * as analyticsRepository from "./analytics.repository.js";

export async function getDashboardAnalytics(userId, days = 7, linkIds = null) {
  const clicks = await analyticsRepository.getClicksByUserId(userId, days, linkIds);
  
  // Compute timeseries
  const timeSeriesMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    timeSeriesMap[dateKey] = 0;
  }

  let uniqueIps = new Set();
  const linkStats = {};

  clicks.forEach(click => {
    const dateKey = click.clicked_at.split("T")[0];
    if (timeSeriesMap[dateKey] !== undefined) {
      timeSeriesMap[dateKey]++;
    }

    if (click.ip_address) uniqueIps.add(click.ip_address);

    const linkId = click.link_id;
    if (!linkStats[linkId]) {
      linkStats[linkId] = {
        title: click.links.title || click.links.short_code,
        shortCode: click.links.short_code,
        clicks: 0
      };
    }
    linkStats[linkId].clicks++;
  });

  const timeSeries = Object.keys(timeSeriesMap)
    .sort()
    .map(date => ({ date, clicks: timeSeriesMap[date] }));

  const topLinks = Object.values(linkStats).sort((a, b) => b.clicks - a.clicks);
  const topLink = topLinks.length > 0 ? topLinks[0].title : "None";

  return {
    totalClicks: clicks.length,
    uniqueVisitors: uniqueIps.size,
    topLink,
    timeSeries
  };
}
