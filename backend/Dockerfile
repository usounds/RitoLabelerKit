# ビルドステージ
FROM node:22-alpine AS builder
WORKDIR /app

# ビルドに必要なパッケージ
RUN apk add --no-cache python3 make g++ sqlite-dev

# 依存関係
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# ソースコピー & ビルド
COPY . .
RUN npm run build

# 本番ステージ
FROM node:22-alpine
WORKDIR /app

# 本番に必要なファイルだけコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

CMD ["npm", "run", "start"]
