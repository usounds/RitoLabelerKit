FROM node:22-slim

WORKDIR /app

# ネイティブ依存がある可能性に備える（better-sqlite3 等）
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

# 依存関係
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# ソース
COPY . .

# TypeScript build
RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]
