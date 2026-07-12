# Architecture Audit

> ⚠️ **Historical snapshot.** Prefer [ARCHITECTURE.md](./ARCHITECTURE.md) and [FINAL_SUBMISSION_REVIEW.md](./FINAL_SUBMISSION_REVIEW.md).

Independent Software Architecture Review Board assessment.

## Evaluation Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Scalability | 8/10 | Stateless API + horizontal scaling; DB is bottleneck |
| Reliability | 8/10 | Outbox, retries, DLQ, health probes |
| Availability | 7/10 | K8s multi-replica; single DB until replica added |
| Maintainability | 9/10 | Clean modules, ADRs, consistent structure |
| Extensibility | 8/10 | Provider adapters, outbox events as contracts |
| Security | 8/10 | Defense in depth; auth endpoints incomplete |
| Operational Excellence | 9/10 | Metrics, tracing, runbooks, CI/CD |

**Overall: 8.0/10** — Production-viable modular monolith.

## Scalability Analysis

**Current architecture supports 100K consultations/day** with 3–10 API replicas, managed PostgreSQL, and Redis.

Bottleneck order at scale:
1. PostgreSQL primary (writes)
2. JWT DB validation (reads per request)
3. In-process queue workers
4. Admin search (ILIKE without dedicated search engine)

## Reliability Analysis

| Mechanism | Assessment |
|-----------|------------|
| Transactional outbox | Correct — atomic with business data |
| Idempotency keys | Correct — prevents duplicate bookings |
| Optimistic locking | Correct — avoids deadlocks |
| Circuit breaker | Present on external providers |
| DLQ | Present; replay not exposed via API |
| Graceful shutdown | SIGTERM + preStop hook |

## Alternative Decisions Considered

| Decision | Alternative | Trade-off |
|----------|-------------|-----------|
| Modular monolith | Microservices | Chosen: simpler ops, ACID booking |
| Optimistic locking | Pessimistic FOR UPDATE | Chosen: throughput; clients handle 409 |
| Outbox | CDC (Debezium) | Outbox simpler for MVP; CDC at higher scale |
| Prisma | Raw SQL / Drizzle | Prisma: type safety; raw SQL for complex reports |
| JWT stateless | Redis sessions | JWT: horizontal scale; no instant revocation |

## Future Microservice Migration Plan

```
Phase 1 (now):     Modular Monolith — 0-100K consultations/day
Phase 2 (100K+):   Extract Notification Worker (already async via outbox)
Phase 3 (250K+):   Extract Analytics/Search (read-heavy, separate scaling)
Phase 4 (500K+):   Extract Booking Service (if team splits)
Phase 5 (1M+):     API Gateway + event bus (Kafka) replacing outbox poller
```

**Extraction criteria:** Independent scaling need, separate team ownership, different SLAs.

Each module already communicates via outbox events — these become inter-service contracts when split.

## Recommendations

1. Add read replica before 100K/day sustained load
2. Extract notification worker as first microservice (lowest risk)
3. Introduce API gateway when >3 client applications
4. Consider Kafka when outbox poller becomes bottleneck (>1000 events/s)
5. Do NOT split booking/payments until team size warrants operational overhead

See [ARCHITECTURE.md](ARCHITECTURE.md) and [adr/](adr/).
