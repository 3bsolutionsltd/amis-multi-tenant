# ── Stage 1: install deps ──────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @amis/api

# ── Stage 2: build ─────────────────────────────────────────
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/ apps/api/
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

WORKDIR /app/apps/api
RUN npx tsc

# ── Stage 3: production image ──────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
