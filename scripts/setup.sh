#!/usr/bin/env bash
# Bootstrap local development environment for Amrutam Backend.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Copying environment file"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "==> Installing dependencies"
npm ci

echo "==> Starting infrastructure (Postgres, Redis, monitoring)"
docker compose -f docker/docker-compose.yml up -d postgres redis prometheus grafana jaeger

echo "==> Waiting for Postgres..."
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U amrutam >/dev/null 2>&1; do
  sleep 2
done

echo "==> Running Prisma migrations"
npx prisma generate
npx prisma migrate deploy

echo "==> Seeding database (optional)"
npm run prisma:seed || true

echo ""
echo "Setup complete. Run one of:"
echo "  npm run start:dev          # Local NestJS with hot reload"
echo "  npm run docker:up          # Full stack in Docker"
echo "  npm run docker:dev         # Docker with hot reload overlay"
