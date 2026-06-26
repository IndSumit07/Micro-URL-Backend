import Redis from "ioredis";
import { env } from "./env.js";
const REDIS_URL = env.redisUrl;

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on("connect", () => {
  console.log("🟢 Redis connected");
});

redis.on("ready", () => {
  console.log("🚀 Redis is ready");
});

redis.on("error", (err) => {
  console.error("🔴 Redis Error:", err.message);
});

redis.on("close", () => {
  console.warn("🟡 Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("♻️ Reconnecting to Redis...");
});

export default redis;
