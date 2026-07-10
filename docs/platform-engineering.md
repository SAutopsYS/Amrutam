# Platform Engineering — Local Development & CI

Guide for repeatable local development, Docker workflows, and CI quality gates.

## One-Command Setup

```bash
npm run setup
```

This script:
1. Copies `.env.example` → `.env` (if missing)
2. Runs `npm ci`
3. Starts Postgres, Redis, Prometheus, Grafana, and Jaeger via Docker Compose
4. Runs Prisma migrations and optional seed

On Windows, the same command invokes `scripts/setup.ps1`.

## Development Modes

| Command | Description |
|---------|-------------|
| `npm run start:dev` | NestJS hot reload (infra in Docker, app on host) |
| `npm run docker:up` | Full production-like stack in Docker |
| `npm run docker:dev` | Docker stack with dev overlay (hot reload, debug port) |
| `npm run docker:down` | Tear down Docker stack |

### Dev Overlay

`docker/docker-compose.dev.yml` mounts source code and runs `nest start --watch` for rapid iteration.

## CI Pipeline

GitHub Actions workflow: `.github/workflows/ci.yml`

| Job | Gate |
|-----|------|
| **install** | Dependencies install + Prisma generate |
| **lint** | ESLint must pass |
| **unit-test** | Jest unit tests + coverage threshold |
| **integration-test** | Supertest against live Postgres + Redis |
| **build** | TypeScript compilation |
| **docker-build** | Multi-stage Dockerfile build |
| **security-audit** | npm audit (high severity) |

CI fails when:
- Lint errors
- Unit or integration tests fail
- Coverage drops below configured thresholds
- Docker build fails

### Local CI Mirror

```bash
npm run ci:local
```

Runs lint, unit tests with coverage gate, integration tests, build, and Docker build.

## Coverage Gates

Thresholds are defined in `package.json` (`coverageThreshold`) and enforced in CI via `scripts/check-coverage.js`. Raise thresholds as test coverage grows.

## Docker Architecture

| Stage | Purpose |
|-------|---------|
| `deps` | Cached `npm ci` layer |
| `builder` | Prisma generate + NestJS build |
| `production` | Minimal runtime, non-root user, healthcheck |

Features:
- Non-root user (`amrutam:1001`)
- `STOPSIGNAL SIGTERM` + graceful shutdown in `main.ts`
- Healthcheck on `/api/v1/health/live`
- Entrypoint runs migrations then starts app

## Scripts Reference

| Script | Path |
|--------|------|
| Setup (bash) | `scripts/setup.sh` |
| Setup (PowerShell) | `scripts/setup.ps1` |
| Dev Docker | `scripts/dev.sh` |
| Local CI | `scripts/ci-local.sh` |
| Coverage gate | `scripts/check-coverage.js` |

## Related Documentation

- [Kubernetes Deployment](../../infra/k8s/README.md)
- [Terraform Infrastructure](../../infra/terraform/README.md)
- [Backup Strategy](../operations/backup.md)
- [Disaster Recovery](../operations/disaster-recovery.md)
- [Observability](../observability.md)
