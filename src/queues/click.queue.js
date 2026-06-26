/**
 * @file click.queue.js
 * @description BullMQ queue for asynchronous click-event processing.
 *
 * When a user follows a short link, we want to:
 *  1. Redirect them instantly (latency-sensitive — must be < 50 ms).
 *  2. Record the click for analytics (can be delayed — fire-and-forget).
 *
 * This queue decouples step 2 from step 1.  The redirect handler adds a job
 * to this queue and returns the 302 immediately.  The worker (`click.worker.js`)
 * consumes the job in the background to:
 *  • Increment the `click_count` column on the link record.
 *  • (Future) Write a full analytics event to the `link_analytics` table.
 *
 * Queue configuration
 * ───────────────────
 *  defaultJobOptions.attempts     → 3 retries on failure
 *  defaultJobOptions.backoff      → Exponential back-off starting at 1 second
 *  defaultJobOptions.removeOnComplete → Keep last 1 000 completed jobs for debugging
 *  defaultJobOptions.removeOnFail → Keep last 5 000 failed jobs for investigation
 *
 * @example
 *   import { clickQueue } from '../queues/click.queue.js';
 *
 *   await clickQueue.add('click', {
 *     linkId:    'uuid',
 *     shortCode: 'aB3kZ',
 *     ip:        '1.2.3.4',
 *     userAgent: 'Mozilla/5.0 ...',
 *     referer:   'https://example.com',
 *     timestamp: new Date().toISOString(),
 *   });
 */

import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../shared/constants/queue.constants.js";
import { bullMQConnection } from "./connection.js";

// ─────────────────────────────────────────────────────────────────────────────
// Queue instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The clicks BullMQ queue.
 *
 * Accepts jobs with name `"click"` and a data payload describing a single
 * redirect event.  Workers registered on this queue handle the asynchronous
 * analytics updates.
 *
 * @type {import('bullmq').Queue}
 */
export const clickQueue = new Queue(QUEUE_NAMES.CLICKS, {
  connection: bullMQConnection,

  defaultJobOptions: {
    /**
     * Retry failed jobs up to 3 times before marking them as permanently
     * failed.  This handles transient database or network issues gracefully.
     */
    attempts: 3,

    /**
     * Exponential back-off: 1 s, 2 s, 4 s between retries.
     * Prevents hammering a temporarily unavailable DB.
     */
    backoff: {
      type: "exponential",
      delay: 1000,
    },

    /**
     * Keep the 1 000 most recent completed jobs in Redis for debugging.
     * Setting to `true` would keep ALL completed jobs and bloat memory.
     */
    removeOnComplete: { count: 1000 },

    /**
     * Keep the 5 000 most recent failed jobs so engineers can inspect
     * payloads without losing analytics data on failure.
     */
    removeOnFail: { count: 5000 },
  },
});
