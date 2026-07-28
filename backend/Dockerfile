# Authoritative game server — portable image for any container host (Fly.io, Railway,
# Cloud Run, a VPS). Multi-stage so the runtime image carries no TypeScript toolchain.

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Production dependencies only — no compiler, smaller surface.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Optional JSON balancing overrides, if the repo ships any.
COPY config ./config

# The file-backed store writes here; mount a volume at /data to make it survive redeploys.
ENV DATA_FILE=/data/anaconda-db.json
RUN mkdir -p /data && chown -R node:node /data

# Never run the game server as root.
USER node
EXPOSE 4000

# The platform's own health check hits /health; this one keeps the container honest too.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
