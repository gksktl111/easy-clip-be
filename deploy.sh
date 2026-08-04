#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/easy-clip-be}"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from .env.production.example before deploying." >&2
  exit 1
fi

git fetch origin main
git reset --hard origin/main

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker image prune -f
