# Reviewer Guide

**Time budget: 20–30 minutes.** Written for hiring panel reviewers who need to evaluate system design, code quality, and production readiness — not line-by-line syntax review.

**Live demo script:** [DEMO.md](./DEMO.md) · **Interview Q&A:** [INTERVIEW_PREP.md](./INTERVIEW_PREP.md)

---

## If You Are Reviewing This Project

Read in this order:

| # | Document / File | Time | Why |
|---|-----------------|------|-----|
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | 8 min | Design intent and trade-offs |
| 2 | [README](../README.md) | 3 min | Scope, setup, conventions |
| 3 | `src/modules/bookings/application/services/create-booking.service.ts` | 5 min | Core use case |
| 4 | `src/events/outbox.service.ts` + `outbox-poller.service.ts` | 4 min | Reliable side effects |
| 5 | `src/modules/bookings/infrastructure/persistence/idempotency.repository.ts` | 2 min | Retry safety |
| 6 | [observability.md](./observability.md) | 3 min | Ops story |
| 7 | [SECURITY.md](../SECURITY.md) | 3 min | Threat model |

---

## Interesting Engineering Decisions

### Why Modular Monolith

Booking + audit + outbox must commit atomically. A distributed transaction across services would require Saga choreography for the highest-contention path. We chose a single deployable unit with module boundaries that map to future extraction points. See [ADR-001](./adr/001-modular-monolith.md).

### Why Prisma

39 models with foreign key relationships need type-safe migrations. Prisma generates TypeScript types from `schema.prisma` and produces reviewable SQL in `prisma/migrations/`. Repositories wrap Prisma so services never import Prisma types directly in controllers. See [ADR-002](./adr/002-prisma-orm.md).

### Why Redis

Two workloads, one infrastructure: (1) cache-aside for doctor search and admin dashboard via `CacheService`, (2) BullMQ backend for async notification jobs. Splitting to separate Redis instances is documented for production scale. See [ADR-004](./adr/004-redis.md).

### Why BullMQ

Notification delivery must survive provider outages. BullMQ provides retry with exponential backoff, job correlation ID propagation, and DLQ routing after 5 failures (`dead-letter.service.ts`). See [ADR-005](./adr/005-bullmq.md).

### Why JWT Rotation

Access tokens are short-lived (15m). Refresh tokens are stored as SHA-256 hashes in `refresh_tokens`, rotated on each `POST /auth/refresh` — the old token is revoked before issuing a new pair. This limits blast radius of a stolen refresh token. See [ADR-007](./adr/007-jwt-authentication.md) and `auth.service.ts`.

### Why Outbox

Publishing to a message broker inside a DB transaction creates dual-write inconsistency. Instead, `OutboxService.storeEvent()` writes to `outbox_events` in the same transaction as the booking. `OutboxPollerService` polls every 5s and enqueues BullMQ jobs. See [ADR-006](./adr/006-transactional-outbox.md).

### Why Optimistic Locking

`SlotRepository.reserveSlot()` uses `updateMany` with `version` and `status = AVAILABLE`. Zero rows updated → `409 SLOT_ALREADY_BOOKED`. Pessimistic `SELECT FOR UPDATE` would hold connections during validation and increase deadlock risk under concurrent morning booking rushes.

### Why CQRS-lite

We do not have separate read databases. But admin dashboard and analytics use cached aggregates (`dashboard.service.ts`, `analytics.service.ts`) while writes go through transactional services. List endpoints use explicit `select` instead of broad `include` to reduce join width — a lightweight read optimization without full CQRS infrastructure.

### Why Cache-Aside

`CacheService.getOrSet()` checks Redis first; on miss, runs the factory function and stores the result with TTL. Stampede protection uses Redis lock keys (`lock:{key}`) so only one request repopulates a cold cache. Cache is never source of truth — PostgreSQL wins on conflict.

---

## What I Optimized

| Area | Before / Problem | After | File |
|------|------------------|-------|------|
| **Database** | JWT loaded full user + profile on every request | `select` only auth fields | `jwt.strategy.ts` |
| **Database** | Dashboard counted entire tables | Date-bounded parallel counts | `dashboard.service.ts` |
| **Database** | List queries over-fetched relations | Explicit `select` on lists | `appointment.repository.ts` |
| **Redis** | Analytics bypassed cache metrics | Unified `CacheService` | `analytics.service.ts` |
| **Indexes** | ILIKE search sequential scans | pg_trgm GIN indexes | performance migration |
| **Indexes** | Outbox poller full table scan | Partial index on PENDING | performance migration |
| **Transactions** | — | Booking + outbox + idempotency in one tx | `create-booking.service.ts` |
| **Caching** | No hit/miss observability | `cache_hits_total` / `cache_misses_total` | `metrics.service.ts` |
| **Tracing** | OTEL SDK without exporter | OTLP export to Jaeger | `tracing.service.ts` |
| **Logging** | Risk of PHI in logs | `sanitizeForLog()` masking | `masking.util.ts` |

---

## Repository Tour

### Architecture

| File | Why read it |
|------|-------------|
| `src/app.module.ts` | Global wiring: guards, interceptors, modules |
| `src/modules/bookings/` | Reference Clean Architecture layout |
| `prisma/schema.prisma` | 39 models — full domain in one place |
| `docs/adr/` | Every major decision documented |

### Performance

| File | Why read it |
|------|-------------|
| `slot.repository.ts` | Optimistic locking implementation |
| `cache.service.ts` | Stampede protection |
| `loadtests/workloads.js` | k6 workload definitions |
| `docs/performance/QUERY_OPTIMIZATION.md` | Index strategy |

### Security

| File | Why read it |
|------|-------------|
| `jwt-auth.guard.ts` | Global auth + security event logging |
| `roles.guard.ts` | RBAC enforcement |
| `global-exception.filter.ts` | Error envelope + no leak |
| `audit.service.ts` | Immutable audit trail |

### Observability

| File | Why read it |
|------|-------------|
| `metrics.service.ts` | Prometheus instrumentation |
| `logging.interceptor.ts` | Request duration logging |
| `correlation.context.ts` | AsyncLocalStorage propagation |
| `health.controller.ts` | K8s probe endpoints |

### Deployment

| File | Why read it |
|------|-------------|
| `docker/Dockerfile` | Multi-stage, non-root, healthcheck |
| `infra/k8s/deployment.yaml` | Probes, resources, preStop |
| `.github/workflows/ci.yml` | CI quality gates |
| `docs/RUNBOOK.md` | Deploy, rollback, troubleshoot |

### Testing

| File | Why read it |
|------|-------------|
| `test/unit/create-booking.service.spec.ts` | Core domain logic tested |
| `test/unit/idempotency.spec.ts` | Idempotency contract |
| `test/integration/auth.integration.spec.ts` | Real auth flow |
| `test/integration/doctors.integration.spec.ts` | Cached search + slots |

---

## Files Worth Reading (Top 15)

| Priority | File | One-line reason |
|----------|------|-----------------|
| ★★★ | `create-booking.service.ts` | Idempotency + transaction + outbox in one use case |
| ★★★ | `slot.repository.ts` | Concurrency — optimistic locking |
| ★★★ | `outbox-poller.service.ts` | Async dispatch, retries, DLQ |
| ★★☆ | `auth.service.ts` | Register/login/refresh with token rotation |
| ★★☆ | `doctor-search.service.ts` | Cache-aside doctor discovery |
| ★★☆ | `prisma/schema.prisma` | Complete domain model |
| ★★☆ | `global-exception.filter.ts` | Error envelope + security logging |
| ★★☆ | `consultation-status.enum.ts` | Domain state machine |
| ★☆☆ | `appointments.controller.ts` | Thin controller + Swagger + idempotency header |
| ★☆☆ | `metrics.service.ts` | Prometheus instrumentation |
| ★☆☆ | `env.validation.ts` | Production safety — fails on weak secrets |
| ★☆☆ | `.github/workflows/ci.yml` | CI quality gates |
| ★☆☆ | `infra/k8s/deployment.yaml` | Production K8s config |
| ★☆☆ | `test/unit/create-booking.service.spec.ts` | How booking logic is tested |
| ★☆☆ | `docs/adr/006-transactional-outbox.md` | Why outbox over direct publish |

---

## Common Reviewer Questions

**Q: Why is test coverage only ~18%?**  
A: Coverage is concentrated on the highest-risk paths — booking, idempotency, state machines, circuit breaker. Infrastructure modules (health, metrics) are thin wiring. Integration tests cover auth, doctors, and health. Raising coverage to 40%+ is documented in GO_LIVE_APPROVAL.

**Q: Why JWT hits the database every request?**  
A: `JwtStrategy.validate()` reloads the user to reject deactivated accounts immediately. We optimized the query to `select` only required fields. A 30s Redis auth cache is documented for scale in SCALING_PLAN.

**Q: Is this production-ready?**  
A: Beta-ready — auth, booking, observability, K8s, CI are in place. Public GA requires k6 SLO validation on staging. See [GO_LIVE_APPROVAL.md](./GO_LIVE_APPROVAL.md).

---

## Documentation Map

| Need | Document |
|------|----------|
| 5-min presentation | [DEMO.md](./DEMO.md) |
| Interview preparation | [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) |
| Assignment compliance | [ASSIGNMENT_COMPLIANCE.md](./ASSIGNMENT_COMPLIANCE.md) |
| Staff engineer eval | [STAFF_ENGINEER_REVIEW.md](./STAFF_ENGINEER_REVIEW.md) |
| Scale to 1M users | [SCALING_PLAN.md](./SCALING_PLAN.md) |
