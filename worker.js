/**
 * @file worker.js
 * @description Background worker process entrypoint.
 *
 * This file is the dedicated entrypoint for all BullMQ workers.
 * It is run as a SEPARATE Node.js process from the HTTP server (server.js)
 * so that background job processing never blocks the main event loop.
 *
 * Process separation benefits
 * ───────────────────────────
 *  • A worker crash does NOT take down the HTTP server.
 *  • The HTTP server's event loop stays free for sub-millisecond redirects.
 *  • Workers can be scaled independently (PM2, Docker, Kubernetes).
 *
 * Workers registered here
 * ───────────────────────
 *  • clickWorker — Processes click events (click_count increment, analytics)
 *
 * Running the worker
 * ──────────────────
 *  node worker.js
 *  # or, with nodemon for development:
 *  nodemon worker.js
 *
 * Graceful shutdown
 * ─────────────────
 *  On SIGTERM / SIGINT the worker finishes in-flight jobs before exiting.
 *  BullMQ handles this automatically when the Worker instance is closed.
 */

import clickWorker from "./src/queues/click.worker.js";

// ─────────────────────────────────────────────────────────────────────────────
// Startup log
// ─────────────────────────────────────────────────────────────────────────────

console.log("🚀 Background worker process started.");
console.log(`   📦 Click worker listening on queue: "${clickWorker.name}"`);

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Graceful shutdown handler.
 *
 * BullMQ workers stop accepting new jobs immediately on close(), then wait
 * for any currently active jobs to finish before the process exits.
 *
 * @param {string} signal - The OS signal received (SIGTERM or SIGINT).
 */
async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down workers gracefully…`);

  try {
    await clickWorker.close();
    console.log("✅ Click worker closed. Goodbye.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during worker shutdown:", err.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
