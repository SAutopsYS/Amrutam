# Demo Guide — 5-Minute Presentation

Structured script for hiring panels, architecture reviews, or technical interviews.  
**Total time: 5 minutes (300 seconds).**

---

## Prep (Before You Present)

```bash
npm run setup && npm run prisma:seed && npm run start:dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/docs | Swagger |
| http://localhost:3000/api/v1/health/ready | Readiness |
| http://localhost:9090 | Prometheus |
| http://localhost:16686 | Jaeger |

---

## 0–30 sec — Introduction

**Say:**

> "I'm presenting the Amrutam Telemedicine Backend — a NestJS modular monolith for an Ayurveda telemedicine platform. It handles auth, doctor discovery, booking, clinical workflows, payments, and admin analytics.
>
> The design constraint that drove every decision is **correctness under concurrency**: two patients cannot book the same slot, and a network retry must not create duplicate bookings."

**Show:** README architecture diagram.

---

## 30–90 sec — Architecture

**Say:**

> "It's a modular monolith — not microservices — because booking, audit, and outbox events need ACID transactions in one boundary. Each module follows Clean Architecture: thin controllers, application services for use cases, infrastructure repositories for Prisma, and domain enums for state machines.
>
> Side effects like notifications go through a transactional outbox — written in the same DB transaction as the booking, then processed asynchronously by a BullMQ worker."

**Show:**

1. [diagrams.md — High-Level Architecture](./diagrams.md#high-level-architecture)
2. `src/modules/bookings/` folder structure
3. `src/app.module.ts` — global guards and interceptors

**Key line:** "Module boundaries are extraction points for future microservices. The outbox events become the inter-service contract."

---

## 90–180 sec — Booking (The Core)

**Say:**

> "Booking is the highest-contention path. Three mechanisms protect it:
>
> 1. **Idempotency keys** — `POST /appointments` requires an `Idempotency-Key` header. Same key and payload returns the cached response. Different payload returns 409.
>
> 2. **Optimistic locking** — `SlotRepository` updates the slot only if `version` matches and status is AVAILABLE. Zero rows updated means someone else got it — we return 409, not 500.
>
> 3. **Transactional outbox** — notification events are written to `outbox_events` in the same transaction. A poller enqueues BullMQ jobs every 5 seconds."

**Show:**

1. [diagrams.md — Booking Sequence](./diagrams.md#booking-sequence-diagram)
2. `create-booking.service.ts` — scroll to `$transaction` block
3. Swagger → `POST /appointments` → highlight `Idempotency-Key`

**Demo (optional):**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@amrutam.test","password":"Password123!"}' \
  | jq -r '.data.accessToken')

# Search doctor + slots
curl "http://localhost:3000/api/v1/doctors?keyword=ayurveda"
```

---

## 180–240 sec — Observability

**Say:**

> "Every request gets a correlation ID via `X-Correlation-Id`, propagated through logs, audit entries, outbox events, and BullMQ jobs. Structured JSON logs mask PHI before emission.
>
> Prometheus metrics are at `/api/v1/metrics` — HTTP latency, DB query time, cache hit ratio, queue depth. OpenTelemetry traces export to Jaeger. Kubernetes uses separate liveness and readiness probes."

**Show:**

```bash
curl -s http://localhost:3000/api/v1/metrics | head -20
curl http://localhost:3000/api/v1/health/ready
```

Open Jaeger UI if OTEL enabled.

---

## 240–300 sec — Security & Close

**Say:**

> "Security is defense in depth: global JWT guard with role decorators, service-level ownership checks, bcrypt passwords, refresh token rotation, immutable audit logs, and Helmet headers.
>
> The repo includes ADRs explaining every major decision, k6 load tests, Kubernetes manifests with HPA and NetworkPolicy, and a full CI pipeline with coverage gates.
>
> Happy to deep-dive into any area — booking concurrency, outbox failure modes, or the scaling plan to 1M users."

**Show:** [SECURITY.md](../SECURITY.md) threat model table · [docs/adr/](./adr/) index

---

## Fallbacks

| If this fails | Do this |
|---------------|---------|
| Booking returns 409 | Explain optimistic locking; show unit test |
| Jaeger empty | Show JSON logs with correlationId |
| No slots available | Show seed data in `prisma/seed.ts` |
| Short on time | Skip observability; focus on booking + outbox |

---

## After the Demo

Point reviewers to:
- [REVIEWER_GUIDE.md](./REVIEWER_GUIDE.md) — 20-min self-guided tour
- [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) — 100 repo-specific Q&A
