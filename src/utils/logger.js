/**
 * @file logger.js
 * @description Centralized application logger built on Winston.
 *
 * - Development: Human-readable colorized output via `winston.format.simple()`
 * - Production:  Structured JSON logs for log aggregation pipelines
 *
 * Usage:
 *   import logger from '../utils/logger.js';
 *   logger.info('Server started', { port: 4000 });
 *   logger.error('Unexpected error', { error: err.message });
 */

import { createLogger, format, transports } from "winston";

const { combine, timestamp, colorize, printf, json, errors } = format;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Pretty-print format used in development */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}${extras}`
      : `[${timestamp}] ${level}: ${message}${extras}`;
  }),
);

/** Structured JSON format used in production */
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// ─────────────────────────────────────────────────────────────────────────────
// Logger instance
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

const logger = createLogger({
  level: isDev ? "debug" : "info",
  format: isDev ? devFormat : prodFormat,
  transports: [new transports.Console()],
  // Prevent Winston from exiting the process on uncaught exceptions
  exitOnError: false,
});

export default logger;
