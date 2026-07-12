# Testing Guide

How tests are organized, what they cover, and how to run them locally and in CI.

---

## Test Strategy

The test pyramid for this repository prioritizes **high-risk business logic** over exhaustive controller coverage.

```
                    ┌─────────────┐
                    │  k6 load    │  Smoke / peak / stress (manual, staging)
                    └──────┬──────┘
               ┌───────────┴───────────┐
               │  Integration (HTTP)   │  Auth, doctors, health — real Postgres + Redis
               └───────────┬───────────┘
          ┌────────────────┴────────────────┐
          │         Unit tests            │  Services, domain rules, guards, utilities
          └─────────────────────────────────┘
```

### What we test heavily

| Risk area | Approach | Files |
|-----------|----------|-------|
| Booking concurrency | Unit tests on service + slot repository | `create-booking.service.spec.ts`, `slot.repository.spec.ts` |
| Idempotency | Unit tests on hash + service replay paths | `idempotency.spec.ts`, `helpers.spec.ts` |
| State machines | Pure domain enum tests | `appointment-status.spec.ts`, `consultation-status.spec.ts` |
| Authorization | Roles guard unit tests | `roles.guard.spec.ts` |
| PHI in logs | Masking utility tests | `masking.spec.ts` |
| Config safety | Env validation rejects weak prod secrets | `env-validation.spec.ts` |
| Resilience | Circuit breaker, payment mock adapter | `circuit-breaker.spec.ts`, `payment-provider.spec.ts` |

### What we test via integration

| Module | Spec | Requires |
|--------|------|----------|
| Auth | `auth.integration.spec.ts` | Postgres, Redis, migrations |
| Doctors | `doctors.integration.spec.ts` | Postgres, Redis, seed data |
| Health | `health.integration.spec.ts` | Postgres, Redis |

### Intentionally light coverage

| Area | Rationale |
|------|-----------|
| Controllers | Thin delegation to services — tested via integration or service unit tests |
| Infrastructure wiring | Health, metrics, telemetry modules are framework glue |
| Admin / analytics | Cached read paths; lower incident risk than booking |
| Outbox poller | Async worker; covered by architecture review + manual ops testing |

This matches the assignment scope: prove correctness on the **booking hot path**, not 100% line coverage.

---

## Test Inventory

### Unit tests (`test/unit/`)

| File | Covers |
|------|--------|
| `create-booking.service.spec.ts` | Idempotency key, replay, validation, happy path |
| `cancel-appointment.service.spec.ts` | Cancel flow and status rules |
| `slot.repository.spec.ts` | Optimistic locking, slot release |
| `idempotency.spec.ts` | Request hash contract |
| `helpers.spec.ts` | `createRequestHash`, normalization |
| `appointment-status.spec.ts` | Appointment state transitions |
| `consultation-status.spec.ts` | Consultation state transitions |
| `prescription-versioning.spec.ts` | Immutable version logic |
| `roles.guard.spec.ts` | RBAC guard |
| `masking.spec.ts` | PHI log sanitization |
| `env-validation.spec.ts` | Production secret validation |
| `metrics.service.spec.ts` | Prometheus counter/histogram recording |
| `correlation.context.spec.ts` | AsyncLocalStorage propagation |
| `circuit-breaker.spec.ts` | External call resilience |
| `payment-provider.spec.ts` | Mock payment adapter |

### Integration tests (`test/integration/`)

| File | Endpoints exercised |
|------|---------------------|
| `auth.integration.spec.ts` | `POST /auth/register`, `/login` |
| `doctors.integration.spec.ts` | `GET /doctors`, `GET /doctors/:id/slots` |
| `health.integration.spec.ts` | `GET /health`, `/health/live`, `/health/ready` |

### Load tests (`loadtests/`)

| Script | Purpose |
|--------|---------|
| `smoke.js` | Quick sanity under low VUs |
| `scenarios/normal.js` | Steady-state traffic |
| `scenarios/peak.js` | Peak hour simulation |
| `scenarios/stress.js` | Beyond capacity |
| `scenarios/spike.js` | Sudden traffic burst |
| `scenarios/soak.js` | Long-running stability |

---

## Coverage

Coverage is enforced in CI via `scripts/check-coverage.js` reading `coverage/coverage-summary.json`.

| Metric | Threshold | Focus |
|--------|-----------|-------|
| Lines | 17% | Global floor — concentrated on risk paths |
| Statements | 17% | Same |
| Functions | 10% | Service methods over controllers |
| Branches | 7% | State machine and error branches |

```bash
npm run test:cov
node scripts/check-coverage.js
```

**Current philosophy:** ~17–20% global coverage with **high density** on booking, idempotency, auth guards, and domain invariants — not blanket controller tests.

Excluded from collection (`package.json`):

- `src/main.ts` — bootstrap only
- `**/*.module.ts` — NestJS wiring

---

## CI Pipeline

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

```mermaid
flowchart LR
    install[install] --> lint[lint]
    install --> unit[unit-test]
    install --> integration[integration-test]
    install --> audit[security-audit]
    lint --> build[build]
    unit --> build
    integration --> build
    build --> docker[docker-build]
```

| Job | Command | Gate |
|-----|---------|------|
| **install** | `npm ci` + `prisma generate` | Dependencies resolve |
| **lint** | `npm run lint` | ESLint flat config passes |
| **unit-test** | `npm test -- --coverage` + `check-coverage.js` | All unit tests + coverage thresholds |
| **integration-test** | `prisma migrate deploy` + `npm run test:integration` | HTTP specs against Postgres 16 + Redis 7 service containers |
| **build** | `npm run build` | TypeScript compiles |
| **docker-build** | `docker/build-push-action` on `docker/Dockerfile` | Image builds |
| **security-audit** | `npm audit --audit-level=high` | No high/critical vulnerabilities |

Environment variables for CI are set in the workflow file (test JWT secrets, `SWAGGER_ENABLED=false`, `OTEL_ENABLED=false`).

---

## How to Run Tests

### Prerequisites

```bash
npm run setup          # .env, deps, Docker infra, migrations
npm run prisma:seed    # Test users for integration tests
```

### Unit tests only (fast, no Docker)

```bash
npm test                 # 51 tests across 17 suites
npm run test:watch     # Watch mode
npm run test:cov       # With coverage report in coverage/
```

### Integration tests (Postgres + Redis required)

```bash
# Start infrastructure
docker compose -f docker/docker-compose.yml up -d postgres redis

# Migrate test database
set DATABASE_URL=postgresql://amrutam:amrutam_secret@localhost:5432/amrutam?schema=public
npx prisma migrate deploy
npm run prisma:seed

npm run test:integration
```

On Linux/macOS, export `DATABASE_URL` instead of `set`.

### Full local CI mirror

```bash
npm run ci:local
```

Runs lint → unit tests with coverage → integration tests → build (see `scripts/ci-local.sh`).

### Load tests

```bash
npm run start:dev      # API must be running
npm run loadtest:smoke
npm run loadtest:normal
```

Requires [k6](https://k6.io/) installed.

### Dev token helpers (manual API testing)

```bash
npm run token:patient
npm run token:doctor
npm run token:admin
```

---

## Adding Tests

Follow [CONTRIBUTING.md](../CONTRIBUTING.md):

- **New business logic** → unit test in `test/unit/`
- **New HTTP endpoint** → integration test if it crosses auth/DB boundaries
- **Performance-sensitive path** → consider k6 workload update

Do not add tests that only assert NestJS or Prisma framework behavior.

---

## Known Gaps (documented, not blocking)

| Gap | Planned mitigation |
|-----|-------------------|
| No booking integration test | Concurrent slot contention test on staging |
| No payment webhook integration test | HMAC verification covered in service review |
| Reschedule service unit test | Cancel + create patterns already tested separately |
| Coverage below 40% | Raise after booking integration test lands |

See [docs/ASSIGNMENT_COMPLIANCE.md](./ASSIGNMENT_COMPLIANCE.md) for requirement traceability.

---

*Last updated: 2026-07-10*
