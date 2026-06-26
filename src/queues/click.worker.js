/**
 * @file click.worker.js
 * @description BullMQ worker that processes click events from the clicks queue.
 *
 * Architecture
 * ────────────
 *  Redirect handler  →  clickQueue.add()  →  [Redis queue]  →  Worker (this file)
 *
 * Each job carries a `ClickJobData` payload describing a single redirect event.
 * The worker:
 *  1. Increments the `click_count` column on the matching link row (fast, atomic RPC).
 *  2. (Extensible) Can be expanded to write full analytics rows, send webhooks, etc.
 *
 * Worker configuration
 * ────────────────────
 *  concurrency  → 5 (process up to 5 click jobs in parallel per worker process)
 *  connection   → Dedicated BullMQ Redis connection (maxRetriesPerRequest: null)
 *
 * Resilience
 * ──────────
 *  • Each job is retried up to 3× with exponential back-off (configured on the queue).
 *  • Errors are logged with the full job payload for post-mortem analysis.
 *  • A Redis outage does NOT affect live redirects — the queue drains on recovery.
 *
 * Running the worker
 * ──────────────────
 *  The worker is started in `worker.js` (project root) as a separate Node process
 *  so it does not block the main HTTP server event loop.
 *
 * @example
 *   // worker.js (entrypoint)
 *   import './src/queues/click.worker.js';
 */

import { Worker } from "bullmq";
import supabase from "../configs/supabase.js";
import logger from "../utils/logger.js";
import { QUEUE_NAMES } from "../shared/constants/queue.constants.js";
import { bullMQConnection } from "./connection.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a User-Agent string into a simple device type.
 *
 * Avoids a third-party UAParser dependency by matching well-known substrings.
 * Good enough for analytics bucketing; not suitable for precise fingerprinting.
 *
 * @param {string|null} userAgent - Raw `User-Agent` header value.
 * @returns {'mobile'|'tablet'|'bot'|'desktop'|'unknown'}
 */
function detectDeviceType(userAgent) {
  if (!userAgent) return "unknown";

  const ua = userAgent.toLowerCase();

  if (/bot|crawler|spider|slurp|ia_archiver|facebookexternalhit|whatsapp|twitterbot/.test(ua)) {
    return "bot";
  }
  if (/ipad|android(?!.*mobile)|tablet/.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

// ─────────────────────────────────────────────────────────────────────────────
// Job processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ClickJobData
 * @property {string} linkId    - UUID of the clicked link (primary key).
 * @property {string} shortCode - Short code that was resolved.
 * @property {string} [ip]      - Client IP address (may be undefined in dev).
 * @property {string} [userAgent] - `User-Agent` header value.
 * @property {string} [referer]   - `Referer` header value.
 * @property {string} timestamp - ISO 8601 datetime when the click occurred.
 */

/**
 * Process a single click job.
 *
 * Steps performed:
 *  1. Call the Supabase `increment_link_click_count` RPC to atomically
 *     bump `click_count` by 1.  This RPC is a PostgreSQL function and
 *     is safe for concurrent workers.
 *
 *  2. (Future) Insert a row into `link_analytics` with full geo/device data.
 *
 * @param {import('bullmq').Job<ClickJobData>} job - The BullMQ job instance.
 * @returns {Promise<void>}
 * @throws Will throw on a Supabase error so BullMQ can schedule a retry.
 */
async function processClickJob(job) {
  const { linkId, shortCode, ip, userAgent, referer, timestamp } = job.data;

  logger.debug("Processing click job", {
    jobId: job.id,
    linkId,
    shortCode,
    attempt: job.attemptsMade + 1,
  });

  // ── Step 1: Increment click count + insert analytics row (concurrent) ────
  //
  // Both operations run in parallel via Promise.all so the job finishes
  // as fast as possible.  If either fails, the error is caught below and
  // BullMQ schedules a retry.
  const [rpcResult, insertResult] = await Promise.all([
    // Atomic click_count increment on the links row
    supabase.rpc("increment_link_click_count", { link_id: linkId }),

    // Full analytics row in the clicks table
    supabase.from("clicks").insert({
      link_id:     linkId,
      clicked_at:  timestamp,
      ip_address:  ip        ?? null,
      user_agent:  userAgent ?? null,
      referrer:    referer   ?? null,
      device_type: detectDeviceType(userAgent),
    }),
  ]);

  // ── Error handling ────────────────────────────────────────────────────────
  if (rpcResult.error) {
    logger.error("Failed to increment click count", {
      jobId: job.id,
      linkId,
      error: rpcResult.error.message,
    });
    // Re-throwing causes BullMQ to retry (up to `attempts` times)
    throw new Error(`RPC error: ${rpcResult.error.message}`);
  }

  if (insertResult.error) {
    logger.error("Failed to insert click analytics row", {
      jobId: job.id,
      linkId,
      error: insertResult.error.message,
    });
    throw new Error(`Insert error: ${insertResult.error.message}`);
  }

  logger.info("Click processed successfully", {
    jobId:      job.id,
    linkId,
    shortCode,
    ip:         ip ?? "unknown",
    deviceType: detectDeviceType(userAgent),
    timestamp,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BullMQ Worker registered on the CLICKS queue.
 *
 * `concurrency: 5` means this single worker process handles up to 5 click
 * jobs simultaneously.  Scale horizontally by running more `worker.js`
 * processes — BullMQ handles the coordination.
 *
 * @type {import('bullmq').Worker}
 */
const clickWorker = new Worker(QUEUE_NAMES.CLICKS, processClickJob, {
  connection: bullMQConnection,
  concurrency: 5,
});

// ─────────────────────────────────────────────────────────────────────────────
// Worker lifecycle events
// ─────────────────────────────────────────────────────────────────────────────

clickWorker.on("completed", (job) => {
  logger.debug("Click job completed", { jobId: job.id, linkId: job.data.linkId });
});

clickWorker.on("failed", (job, err) => {
  logger.error("Click job failed", {
    jobId: job?.id,
    linkId: job?.data?.linkId,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
});

clickWorker.on("error", (err) => {
  logger.error("Click worker error", { error: err.message });
});

export default clickWorker;
