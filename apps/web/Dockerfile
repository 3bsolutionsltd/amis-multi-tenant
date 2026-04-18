# ── Stage 1: install deps ──────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @amis/web

# ── Stage 2: build ─────────────────────────────────────────
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web/ apps/web/
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN npx vite build

# ── Stage 3: serve with nginx ──────────────────────────────
FROM nginx:alpine AS runner

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
