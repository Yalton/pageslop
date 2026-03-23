# --- Base ---
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner (Next.js app) ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy full node_modules for worker (tsx + all transitive deps)
COPY --from=deps /app/node_modules ./node_modules

# Copy worker source + libs it imports
COPY --from=builder /app/src/workers ./src/workers
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/types ./src/types

# Copy drizzle config for db:push
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
