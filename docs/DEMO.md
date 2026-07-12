# Demo Guide — 5-Minute Presentation Screenplay

Structured **screenplay** for hiring panels.  
**Total time: 5 minutes (300 seconds).**  
Canonical companion: [FINAL_SUBMISSION_REVIEW.md](./FINAL_SUBMISSION_REVIEW.md) (Steps 4–6).

---

## Prep (Before Recording)

```bash
cp .env.example .env
npm install
npm run docker:up          # Postgres, Redis, API, Prometheus, Grafana, Jaeger
# OR local: npm run setup && npm run prisma:migrate && npm run prisma:seed && npm run start:dev
npm run prisma:deploy && npm run prisma:seed   # if API container needs seed
npm test && npm run build
```

| Tab / URL | Purpose |
|-----------|---------|
| Browser A | http://localhost:3000/docs — Swagger |
| Browser B | http://localhost:16686 — Jaeger |
| Browser C | http://localhost:9090 — Prometheus |
| Browser D | http://localhost:3001 — Grafana (admin/admin) |
| Browser E | GitHub repo → Actions → CI |
| IDE | `docs/ARCHITECTURE.md`, `create-booking.service.ts` |
| Terminal 1 | API logs / curl |
| Terminal 2 | Optional k6 |

Seed users have **MFA off** — login returns tokens directly. MFA demo is optional (section 3b).

---

## Screenplay

### 00:00–00:20 — Opening

| # | Cue |
|---|-----|
| **Time** | 00:00–00:20 |
| **Say** | "This is the Amrutam Telemedicine Backend — a NestJS modular monolith for Ayurveda telemedicine. The design constraint that drove every decision is **correctness under concurrency**: two patients cannot book the same slot, and a network retry must not create duplicate bookings." |
| **File** | `README.md` |
| **Endpoint** | — |
| **Browser** | README on GitHub or local |
| **Terminal** | — |
| **Swagger** | — |
| **Code** | — |
| **Diagram** | README Mermaid overview |
| **Docs** | README §1–3 |
| **Logs / Metrics** | — |
| **GitHub / CI** | Repository home |
| **Folder** | Repo root |

**Screen:** README hero + badges + reviewer callout.

---

### 00:20–00:50 — Architecture

| # | Cue |
|---|-----|
| **Time** | 00:20–00:50 |
| **Say** | "Modular monolith — not microservices — because booking, audit, and outbox need ACID in one boundary. Clean Architecture per module: controllers, application services, Prisma repositories, domain enums. Side effects go through a transactional outbox → BullMQ." |
| **File** | `docs/ARCHITECTURE.md` |
| **Endpoint** | — |
| **Browser** | Architecture doc |
| **Terminal** | — |
| **Swagger** | — |
| **Code** | `src/app.module.ts` (flash) |
| **Diagram** | `docs/diagrams.md` — High-Level Architecture |
| **Docs** | ARCHITECTURE.md · ADR-001 |
| **Logs / Metrics** | — |
| **GitHub / CI** | — |
| **Folder** | `src/modules/` |

**Highlight:** PostgreSQL · Redis · BullMQ · Prisma · Outbox.

---

### 00:50–01:20 — Auth & MFA

| # | Cue |
|---|-----|
| **Time** | 00:50–01:20 |
| **Say** | "Auth is JWT with refresh rotation and RBAC. MFA is production TOTP — secrets encrypted AES-256-GCM. Login either returns tokens or an MFA challenge token." |
| **File** | `src/modules/auth/presentation/auth.controller.ts` |
| **Endpoint** | `POST /api/v1/auth/login` |
| **Browser** | Swagger → Auth → Login |
| **Terminal** | Optional curl login |
| **Swagger** | http://localhost:3000/docs → Auth |
| **Code** | `mfa.service.ts` (1 scroll) |
| **Diagram** | README auth Mermaid (§14) |
| **Docs** | SECURITY.md MFA section |
| **Logs / Metrics** | — |
| **GitHub / CI** | — |
| **Folder** | `src/modules/auth/` |

**Demo curl:**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@amrutam.test","password":"Password123!"}'
```

Authorize Swagger with `Bearer <accessToken>`.

---

### 01:20–02:20 — Booking (core)

| # | Cue |
|---|-----|
| **Time** | 01:20–02:20 |
| **Say** | "Three protections: Idempotency-Key caches the response; optimistic locking on slot version returns 409 on conflict; outbox events write in the same transaction as the booking." |
| **File** | `src/modules/bookings/application/services/create-booking.service.ts` |
| **Endpoint** | `POST /api/v1/appointments` + `Idempotency-Key` |
| **Browser** | Swagger → Appointments |
| **Terminal** | curl book (optional) |
| **Swagger** | Try it out with Idempotency-Key |
| **Code** | `$transaction` + `SlotRepository` |
| **Diagram** | `docs/diagrams.md` — Booking Sequence |
| **Docs** | ADR on idempotency / outbox |
| **Logs / Metrics** | — |
| **GitHub / CI** | — |
| **Folder** | `src/modules/bookings/` |

Also flash: `slot.repository.ts` (version WHERE), `outbox.service.ts`.

---

### 02:20–02:50 — Clinical + Prescription

| # | Cue |
|---|-----|
| **Time** | 02:20–02:50 |
| **Say** | "Consultations are a state machine. Prescriptions are append-only versioned — updates never overwrite history." |
| **File** | `src/modules/consultations/` · `prescriptions/` |
| **Endpoint** | `POST /consultations/:id/start` · `PATCH /prescriptions/:id` |
| **Browser** | Swagger tags Consultations / Prescriptions |
| **Terminal** | — |
| **Swagger** | Those tags |
| **Code** | Prescription version repository (flash) |
| **Diagram** | diagrams.md clinical flow (if present) |
| **Docs** | ARCHITECTURE clinical section |
| **Logs / Metrics** | — |
| **GitHub / CI** | — |
| **Folder** | `src/modules/consultations/` |

---

### 02:50–03:20 — Observability

| # | Cue |
|---|-----|
| **Time** | 02:50–03:20 |
| **Say** | "Every request gets a correlation ID. Metrics at /metrics. Traces to Jaeger. Separate liveness and readiness for Kubernetes." |
| **File** | `docs/observability.md` |
| **Endpoint** | `GET /api/v1/metrics` · `GET /api/v1/health/ready` |
| **Browser** | Prometheus 9090 · Jaeger 16686 |
| **Terminal** | `curl -s .../metrics \| head` |
| **Swagger** | Health tag |
| **Code** | `metrics.service.ts` (optional) |
| **Diagram** | — |
| **Docs** | observability.md |
| **Logs** | Winston JSON with masked PHI |
| **Metrics** | Prometheus scrape |
| **GitHub / CI** | — |
| **Folder** | `src/metrics/` · `src/telemetry/` |

```bash
curl -s http://localhost:3000/api/v1/health/ready
curl -s http://localhost:3000/api/v1/metrics | head -20
```

---

### 03:20–03:50 — Infra (Docker / Terraform / K8s)

| # | Cue |
|---|-----|
| **Time** | 03:20–03:50 |
| **Say** | "Multi-stage Docker, Compose with Postgres Redis Prometheus Grafana Jaeger. Terraform modules for VPC RDS Redis ALB ECS secrets monitoring. Kubernetes with HPA PDB NetworkPolicy." |
| **File** | `docker/Dockerfile` · `infra/terraform/main.tf` · `infra/k8s/deployment.yaml` |
| **Endpoint** | — |
| **Browser** | Folder tree in IDE |
| **Terminal** | Optional `terraform validate` |
| **Swagger** | — |
| **Code** | — |
| **Diagram** | — |
| **Docs** | `infra/terraform/README.md` |
| **Logs / Metrics** | Grafana 3001 briefly |
| **GitHub / CI** | — |
| **Folder** | `docker/` · `infra/` |

---

### 03:50–04:20 — CI, Tests, Security

| # | Cue |
|---|-----|
| **Time** | 03:50–04:20 |
| **Say** | "CI runs lint, unit, integration with Postgres/Redis, build, docker, dependency audit. Unit tests cover booking locks, MFA crypto, guards. Security docs include threat model and checklist. MFA and audit logs close the loop." |
| **File** | `.github/workflows/ci.yml` · `SECURITY.md` |
| **Endpoint** | `GET /admin/audit` (mention) |
| **Browser** | GitHub Actions green run |
| **Terminal** | `npm test` result |
| **Swagger** | Admin → audit (optional) |
| **Code** | `test/unit/create-booking.service.spec.ts` |
| **Diagram** | — |
| **Docs** | threat-model.md · security-checklist.md |
| **Logs / Metrics** | — |
| **GitHub / CI** | Actions tab |
| **Folder** | `test/` · `docs/security/` |

---

### 04:20–04:50 — Performance + Docs pack

| # | Cue |
|---|-----|
| **Time** | 04:20–04:50 |
| **Say** | "k6 scenarios include smoke normal peak stress spike soak and a dedicated benchmark. Report lives under docs/performance. Reviewer guide and 100 interview Q&A are in the repo." |
| **File** | `docs/performance/BENCHMARK_REPORT.md` · `docs/REVIEWER_GUIDE.md` |
| **Endpoint** | — |
| **Browser** | Benchmark report |
| **Terminal** | Mention `npm run loadtest:benchmark` |
| **Swagger** | — |
| **Code** | `loadtests/scenarios/benchmark.js` |
| **Diagram** | — |
| **Docs** | BENCHMARK_REPORT · INTERVIEW_PREP |
| **Logs / Metrics** | — |
| **GitHub / CI** | — |
| **Folder** | `loadtests/` · `docs/` |

---

### 04:50–05:00 — Close

| # | Cue |
|---|-----|
| **Time** | 04:50–05:00 |
| **Say** | "Happy to deep-dive booking concurrency, outbox failure modes, MFA crypto, or the scaling plan to 1M users. Start with REVIEWER_GUIDE — twenty minutes to the core paths." |
| **File** | `docs/REVIEWER_GUIDE.md` |
| **Endpoint** | — |
| **Browser** | REVIEWER_GUIDE |
| **Terminal** | — |
| **Swagger** | — |
| **Code** | — |
| **Diagram** | — |
| **Docs** | REVIEWER_GUIDE · FINAL_SUBMISSION_REVIEW |
| **Logs / Metrics** | — |
| **GitHub / CI** | Star the tree one last time |
| **Folder** | Repo root |

---

## Optional 3b — MFA live (if time / MFA_ENABLED=true)

1. Login as doctor → Authorize  
2. `POST /auth/mfa/enable` → show QR / otpauth URL  
3. `POST /auth/mfa/verify-setup` with TOTP  
4. Logout → login → show `mfaRequired` + `mfaToken`  
5. `POST /auth/mfa/verify` → tokens  

---

## Fallbacks

| If this fails | Do this |
|---------------|---------|
| Booking 409 | Explain optimistic locking; show unit test |
| Jaeger empty | Show JSON logs with correlationId |
| No slots | Show `prisma/seed.ts` |
| Short on time | Skip clinical + Grafana; keep booking + CI |

---

## After the Demo

- [REVIEWER_GUIDE.md](./REVIEWER_GUIDE.md)  
- [INTERVIEW_PREP.md](./INTERVIEW_PREP.md)  
- [FINAL_SUBMISSION_REVIEW.md](./FINAL_SUBMISSION_REVIEW.md)  
- [SUBMISSION_AUDIT.md](./SUBMISSION_AUDIT.md)
