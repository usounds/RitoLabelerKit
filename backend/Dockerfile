# Node.js 20 をベースに
FROM node:20-bullseye

# 作業ディレクトリ
WORKDIR /app

# 依存関係を先にコピーしてキャッシュを活用
COPY package.json pnpm-lock.yaml ./

# pnpm インストール
RUN npm install -g pnpm

# 依存パッケージをインストール
RUN pnpm install --frozen-lockfile --prefer-offline

# アプリケーションコードをコピー
COPY . .

# データフォルダを作る
RUN mkdir -p /app/data

# 永続化するディレクトリを指定
VOLUME ["/app/data"]

# ポート公開
EXPOSE 14831

# 起動コマンド
CMD ["pnpm", "dlx", "tsx", "src/index.ts"]
