/**
 * @file connection.js
 * @description Shared BullMQ Redis connection used by all queues and workers.
 *
 * BullMQ requires a dedicated `ioredis` connection that has
 * `maxRetriesPerRequest` set to `null` — this is mandatory for BullMQ
 * blocking commands (BRPOP, XREAD, etc.) to work correctly.
 *
 * This connection is intentionally separate from the application-level
 * Redis client in `configs/redis.js` to avoid conflicts between BullMQ's
 * connection lifecycle and the general-purpose cache client.
 *
 * @example
 *   import { bullMQConnection } from '../queues/connection.js';
 *   const queue = new Queue('my-queue', { connection: bullMQConnection });
 */

import Redis from "ioredis";
import { env } from "../configs/env.js";

// ─────────────────────────────────────────────────────────────────────────────
// BullMQ-dedicated Redis connection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A shared `ioredis` instance configured specifically for BullMQ.
 *
 * Key differences from the general `configs/redis.js` client:
 *  • `maxRetriesPerRequest: null`  – Required by BullMQ for blocking commands.
 *  • `enableReadyCheck: false`     – BullMQ manages its own ready state.
 *  • `lazyConnect: false`          – Connect eagerly so the worker is ready
 *                                    before the first job arrives.
 *
 * @type {import('ioredis').Redis}
 */
export const bullMQConnection = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,   // BullMQ requirement — do NOT remove
  enableReadyCheck: false,      // BullMQ manages its own health checks
  lazyConnect: false,           // Eager connection for worker readiness
});

bullMQConnection.on("connect", () => {
  console.log("🟢 BullMQ Redis connected");
});

bullMQConnection.on("error", (err) => {
  console.error("🔴 BullMQ Redis error:", err.message);
});
