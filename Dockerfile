# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install only production dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy manifests first to leverage Docker layer cache
COPY package.json package-lock.json ./

# Install only production dependencies (skip devDependencies)
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner: final lightweight image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY server.js ./
COPY worker.js ./
COPY src/ ./src/

# Transfer ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the HTTP port (matches PORT env var)
EXPOSE 4000

# Healthcheck — polls the /api/health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# Default command: start the HTTP server
# The worker is started via a separate service in docker-compose.yml
CMD ["node", "server.js"]
