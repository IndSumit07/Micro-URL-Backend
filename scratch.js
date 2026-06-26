import { getDashboardAnalytics } from "./src/modules/analytics/analytics.service.js";

async function run() {
  try {
    const data = await getDashboardAnalytics("bd3d2bfe-42b9-42f4-90aa-a1f323894e20", 7);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
