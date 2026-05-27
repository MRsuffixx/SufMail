# ─── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

# ─── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG SKIP_ENV_VALIDATION=1

RUN pnpm build

# ─── Stage 3: Runner (production) ─────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001

WORKDIR /app

RUN mkdir -p /app/uploads && chown nextjs:nextjs /app/uploads

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nextjs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# ─── Stage 4: Worker ──────────────────────────────────────────────────────────
FROM node:20-alpine AS worker

RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next/standalone ./

RUN chown -R nextjs:nextjs /app

USER nextjs

CMD ["node", "server.js"]