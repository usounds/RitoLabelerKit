# ---------- base ----------
FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

# ---------- deps ----------
FROM base AS deps

# ★ native addon 用ツール
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./

# ★ postinstall をちゃんと走らせる
RUN pnpm install --frozen-lockfile \
 && pnpm approve-builds esbuild better-sqlite3

# ---------- build ----------
FROM deps AS build
COPY . .
RUN pnpm build

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]
