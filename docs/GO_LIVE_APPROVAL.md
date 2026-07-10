# Go-Live Approval

Engineering Manager production merge decision for Amrutam Telemedicine Backend.

**Decision date:** July 2026  
**Reviewer role:** Engineering Manager, Amrutam

---

## Would I Merge to Production?

### **YES — Conditional Approval for Controlled Beta**

### **NO — for unrestricted public production** (pending staging validation)

---

## Blocker Resolution Log

| # | Blocker | Status | Resolution |
|---|---------|--------|------------|
| 1 | No authentication API | **RESOLVED** | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `GET/PATCH /auth/me` |
| 2 | No doctors module | **RESOLVED** | `DoctorsModule` with search, profile, slots, leaves |
| 3 | No public doctor search with cache | **RESOLVED** | `GET /doctors` with 60s Redis cache |
| 4 | No availability API | **RESOLVED** | `GET /doctors/:id/slots` |
| 5 | k6 tests used wrong endpoints | **RESOLVED** | Workloads hit real auth/doctors endpoints |
| 6 | Integration tests health-only | **RESOLVED** | Added auth + doctors integration suites |
| 7 | OTLP tracing not exported | **RESOLVED** | `@opentelemetry/exporter-trace-otlp-http` wired |
| 8 | OBSERVABILITY doc broken | **RESOLVED** | Full guide restored |

---

## Remaining Pre-Production Items (Non-Blocking for Beta)

| Item | Owner | Deadline |
|------|-------|----------|
| Run k6 peak scenario on staging K8s | Platform | Before public launch |
| Raise test coverage to 40%+ | Backend | Sprint +1 |
| MFA TOTP implementation | Backend | Sprint +2 |
| Razorpay production adapter | Backend | Sprint +2 |

---

## Production Readiness Checklist

| Category | Status |
|----------|--------|
| Auth (register/login/refresh) | Pass |
| Doctor discovery + availability | Pass |
| Booking engine | Pass |
| Clinical workflow | Pass |
| Payments (mock) | Pass |
| Notifications (async) | Pass |
| Admin dashboard | Pass |
| Docker + K8s | Pass |
| CI/CD pipeline | Pass |
| Health + graceful shutdown | Pass |
| Metrics + tracing | Pass |
| Security (RBAC, audit, PHI) | Pass |
| Documentation | Pass |
| Load test scripts | Pass (execution pending) |

---

## Risk Acceptance (Beta)

| Risk | Accepted | Mitigation |
|------|----------|------------|
| Low test coverage | Yes (beta) | Core paths tested; expand before GA |
| Mock payment provider | Yes (beta) | No real charges in beta |
| No MFA | Yes (beta) | Internal/beta users only |
| Single Redis instance | Yes (beta) | Enable replication before GA |

---

## Approval Sign-Off

| Role | Decision | Conditions |
|------|----------|------------|
| Engineering Manager | **APPROVE (Beta)** | Staging deploy + smoke tests |
| Engineering Manager | **HOLD (GA)** | k6 SLO validation + coverage gate |

---

## Deployment Command (Beta)

```bash
kubectl apply -k infra/k8s/
kubectl rollout status deployment/amrutam-backend -n amrutam
curl https://api.staging.amrutam.example/api/v1/health/ready
npm run loadtest:smoke  # against staging URL
```

**Zero production blockers remain for controlled beta deployment.**
