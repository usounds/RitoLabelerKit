# Rito Reverse Proxy

A lightweight reverse proxy Docker image designed to sit in front of backend services.
Primarily intended for Bluesky-related services and internal APIs, but usable as a general-purpose reverse proxy.

It routes requests between Rito-originated APIs and non-Rito backend APIs,
and supports external WebSocket connections for Skyware when deployed on Railway.

## Features

- Runs in Docker-based environments

- Built for linux/amd64

- Intended for HTTPS termination and request routing

- Clean separation between proxy and application services

## Build & Push

To build and push the image to GitHub Container Registry (ghcr.io):

> docker buildx build \
>   --platform linux/amd64 \
>   --push \
>   -t ghcr.io/usounds/ritoreverseproxy:latest \
>   .