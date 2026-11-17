# Cactu bot on Bun, running the TypeScript sources directly (no build step).
#   docker build -t cactu-bot .
#   docker run -d --name cactu-bot --env-file playground/.env -v cactu-namespaces:/app/namespaces --memory 256m cactu-bot

# Production dependencies only. Debian-based "slim": canvas ships prebuilt binaries for glibc, Alpine would need to compile it
FROM oven/bun:1.4.3-slim AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production



FROM oven/bun:1.4.3-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json tsconfig.json index.ts ./
COPY src ./src
COPY modules ./modules
COPY playground/index.ts ./playground/index.ts

COPY --chown=bun:bun namespaces/_default.json ./namespaces/_default.json
VOLUME /app/namespaces

# The minecraft module's language files cache (downloaded on the first event), writable by the bot
RUN mkdir modules/minecraft/_translation && chown bun:bun modules/minecraft/_translation

# Minecraft events from the Cactu backend (CACTU_BOT_PORT)
EXPOSE 3002

USER bun

CMD [ "bun", "--smol", "playground/index.ts" ]
