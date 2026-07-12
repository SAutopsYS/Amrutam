# Changelog

All notable changes to the Amrutam Telemedicine Backend.  
Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## [1.0.0] — 2026-07-10

### Added — Core Platform

- NestJS modular monolith with Clean Architecture per module
- PostgreSQL 16 + Prisma ORM (39 models)
- Redis cache-aside with stampede protection (`CacheService`)
- BullMQ async job processing with DLQ (`DeadLetterService`)
- Winston structured JSON logging with PHI masking
- Prometheus metrics at `/api/v1/metrics`
- OpenTelemetry tracing with OTLP export to Jaeger
- Health endpoints: liveness, readiness, full system check
- Graceful shutdown on SIGTERM/SIGINT
- Multi-stage Docker image (non-root, healthcheck)
- Docker Compose: API, Postgres, Redis, Prometheus, Grafana, Jaeger
- GitHub Actions CI: lint, unit test, integration test, build, docker-build
- Kubernetes manifests: Deployment, Service, Ingress, HPA, PDB, NetworkPolicy
- Terraform infrastructure skeleton

### Added — Authentication

- `POST /auth/register` — patient registration with bcrypt
- `POST /auth/login` — JWT access + refresh token issuance
- `POST /auth/refresh` — refresh token rotation (revokes previous)
- `POST /auth/logout` — refresh token revocation
- `GET/PATCH /auth/me` — profile read/update
- Global `JwtAuthGuard` with `@Public()` opt-out
- `RolesGuard` with `@Roles()` decorator

### Added — Doctors

- `GET /doctors` — cached doctor search (60s TTL, pg_trgm indexes)
- `GET /doctors/:id` — doctor profile
- `GET /doctors/:id/slots` — available slot listing
- `POST /doctors/me/slots` — doctor slot creation
- `POST/GET /doctors/me/leaves` — leave management

### Added — Booking

- Idempotent booking with `Idempotency-Key` header and payload hashing
- Optimistic locking on `AvailabilitySlot.version`
- Cancel and reschedule with audit + outbox events
- Transactional outbox pattern for reliable side effects

### Added — Clinical

- Consultation lifecycle (start, complete) with state machine
- Append-only clinical notes versioning
- Immutable prescription version history

### Added — Payments & Notifications

- Provider-agnostic payment interface (Mock + Razorpay skeleton)
- Payment webhooks with HMAC verification
- Refund support
- Async notification delivery via outbox → BullMQ

### Added — Admin

- Cached dashboard metrics
- Analytics reporting with date ranges
- Global admin search
- Immutable audit log query platform

### Added — Documentation

- README, ARCHITECTURE.md, 8 ADRs, diagrams (Mermaid)
- SECURITY.md, observability guide, RUNBOOK.md
- REVIEWER_GUIDE.md, DEMO.md, INTERVIEW_PREP.md
- ASSIGNMENT_COMPLIANCE.md, GO_LIVE_APPROVAL.md
- SCALING_PLAN.md, STAFF_ENGINEER_REVIEW.md
- Performance benchmark and query optimization reports

### Added — Testing & Performance

- 31 unit tests (booking, idempotency, state machines, metrics)
- Integration tests: health, auth, doctors
- k6 load tests: normal, peak, stress, spike, soak scenarios
- Performance index migration (pg_trgm, partial outbox, date indexes)

### Changed

- JWT validation optimized to `select` (not full `include`)
- Dashboard queries date-bounded and fully parallelized
- List endpoints use explicit `select` instead of broad `include`
- Analytics unified through `CacheService` with hit/miss metrics

### Security

- Helmet headers, CORS allowlist, rate limiting
- Env validation rejects weak secrets in production
- Immutable audit trail on sensitive operations
- PHI masking in structured logs

---

## [Unreleased]

### Added

- Production TOTP MFA (enable, verify-setup, challenge, disable) with AES-encrypted secrets and recovery codes
- MFA Prisma migration (`mfaPendingSecret`, `mfaRecoveryCodes`) + unit/integration tests
- OpenAPI MFA paths and login MFA-challenge examples
- AWS Terraform modules: networking, security groups, RDS, Redis, ALB, ECS, secrets, monitoring, optional EKS
- k6 benchmark suite for auth, doctor search, booking, consultation (`npm run loadtest:benchmark`)
- `npm run docker:up`, `loadtest:stress|spike|soak` scripts
- LICENSE (UNLICENSED) + final submission review pack

### Planned

- Redis auth cache for JWT validation at scale
- Availability rules → automatic slot generation
- Booking integration test suite
- Materialized views for admin dashboard
- Notification worker extraction to separate deployment

---

[1.0.0]: https://github.com/amrutam/amrutam-backend/releases/tag/v1.0.0
