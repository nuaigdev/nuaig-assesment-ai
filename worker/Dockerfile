# Agent worker image for Railway / Render / Fly (spec §6.1). Always-on; not a serverless function.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
# @livekit/rtc-node's native (Rust) client verifies TLS against the system CA store, which the
# slim image doesn't ship. Node's own fetch uses bundled certificates, so only this needs it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 8080
CMD ["node", "dist/main.js", "start"]
