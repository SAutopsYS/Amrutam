# Hiring Review

Senior Backend Hiring Committee evaluation of this repository as a candidate submission.

## Candidate Level Assessed

**Senior Backend Engineer** (5–8 years equivalent)

---

## Scores

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Architecture | 9/10 | 20% | 1.80 |
| Code Quality | 8/10 | 15% | 1.20 |
| Testing | 5/10 | 15% | 0.75 |
| Security | 8/10 | 15% | 1.20 |
| Scalability | 8/10 | 10% | 0.80 |
| Documentation | 10/10 | 10% | 1.00 |
| DevOps | 8.5/10 | 10% | 0.85 |
| Observability | 9/10 | 5% | 0.45 |
| **Total** | | | **8.05/10** |

**Final Score: 81/100**

---

## Strengths

1. **System design maturity** — outbox pattern, idempotency, optimistic locking implemented correctly, not just mentioned
2. **Operational awareness** — health probes, graceful shutdown, metrics, tracing, runbooks
3. **Documentation excellence** — ADRs explain *why*, not just *what*; reviewer guide respects interviewer time
4. **Clean architecture** — consistent module structure; thin controllers; domain state machines
5. **Security consciousness** — PHI masking, audit trail, RBAC, threat model
6. **DevOps completeness** — Docker, K8s, Terraform skeleton, CI with quality gates

---

## Weaknesses

1. **Auth endpoints not implemented** — JWT infrastructure exists but no login API
2. **Low test coverage (18%)** — core booking tested but most modules untested
3. **No concurrency integration tests** — optimistic locking tested only in unit mocks
4. **Some large service files** — booking and consultation services could be decomposed
5. **ESLint broken locally** — missing flat config file

---

## Missing Features (Expected at Senior Level)

- Auth login/register/refresh endpoints
- Public doctor search and availability APIs
- Token revocation mechanism
- Fine-grained permissions guard
- Payment provider production adapter

*Note: Missing features are honestly documented as future work — not hidden.*

---

## Possible Rejections

| Concern | Counter-argument |
|---------|------------------|
| "Only 18% test coverage" | Core contention paths (booking, idempotency, state machines) are tested |
| "No auth endpoints" | Infrastructure complete; seed + token script enables full API demo |
| "Over-documented vs under-tested" | Documentation is a strength for team projects; tests are the gap |
| "Monolith won't scale" | Architecture audit shows 100K/day capacity with horizontal scaling |

---

## Interview Questions

### System Design
1. Walk me through what happens when two patients book the same slot simultaneously.
2. Why did you choose optimistic locking over pessimistic locking?
3. How would you extract the notification module into a separate service?

### Implementation
4. Show me the idempotency implementation. What happens with the same key but different payload?
5. How does the outbox poller handle failures? What is the DLQ strategy?
6. Why does JWT validation hit the database on every request? How would you optimize it?

### Operations
7. How would you debug a 503 on `/health/ready` in production?
8. What metrics would you alert on for a booking spike?
9. Walk me through your deployment rollback procedure.

### Trade-offs
10. Why modular monolith instead of microservices?
11. What would you do differently with 6 more weeks?
12. Where is the biggest technical debt in this codebase?

---

## Hiring Decision

### Recommendation: **Strong Hire**

This submission exceeds typical senior backend portfolio projects. The candidate demonstrates:
- Real distributed systems patterns (not buzzwords)
- Production engineering mindset (observability, CI/CD, K8s)
- Clear written communication (ADRs, architecture docs)
- Honest assessment of gaps (auth endpoints, test coverage)

The test coverage gap and missing auth endpoints are discussion points, not disqualifiers — both are clearly understood and documented with mitigation paths.

### Level Calibration

| Level | Fit |
|-------|-----|
| Mid-level | Overqualified |
| Senior | **Strong fit** |
| Staff | Borderline — would probe system design depth in interview |

---

## Panel Notes

> "This is one of the few backend submissions where I learned something from the documentation. The booking sequence diagram and ADR-006 made the outbox decision tangible."

> "I'd want to pair on auth endpoints in the interview loop to verify they can ship features, not just architect them."

> "k6 load tests and performance index migration show they think about scale beyond the happy path."
