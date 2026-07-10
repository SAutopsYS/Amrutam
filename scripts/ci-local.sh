#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run lint
npm test -- --coverage
npm run test:integration
npm run build
docker build -f docker/Dockerfile -t amrutam-backend:local .

echo "All checks passed."
