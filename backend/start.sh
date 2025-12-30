#!/bin/sh

# Fastify (LabelerServer) をバックグラウンドで起動
node /app/dist/index.js &

# Caddy をフォアグラウンドで起動
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
