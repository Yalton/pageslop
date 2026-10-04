# --- Base ---
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libgbm1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Production dependencies (runtime image only) ---
# tsx (worker) and drizzle-kit (entrypoint schema push) are regular
# dependencies so they survive --omit=dev.
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_ALLOW_SIGNUP=true
ENV NEXT_PUBLIC_ALLOW_SIGNUP=$NEXT_PUBLIC_ALLOW_SIGNUP
ARG NEXT_PUBLIC_EXTENSION_DOCS_URL=
ENV NEXT_PUBLIC_EXTENSION_DOCS_URL=$NEXT_PUBLIC_EXTENSION_DOCS_URL
RUN npm run build

# --- Runner (Next.js app + worker) ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Production node_modules for the worker and drizzle-kit, no devDependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy worker source + libs it imports
COPY --from=builder /app/src/workers ./src/workers
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/types ./src/types

# Copy drizzle config for db:push
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create screenshot storage directory
RUN mkdir -p /app/data/screenshots
VOLUME /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
