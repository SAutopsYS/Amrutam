# Scaling Plan — 1 Million Users

CTO architecture review for scaling Amrutam from 100K to 1M+ active users.

## Current State Assumptions

| Metric | At 100K consultations/day | At 1M users |
|--------|---------------------------|-------------|
| Daily consultations | 100,000 | 500,000–1,000,000 |
| Peak API RPS | ~150 | ~2,000–5,000 |
| Database size | ~50 GB | ~500 GB–2 TB |
| Audit log growth | ~1M rows/month | ~20M rows/month |

## Architecture Decisions — Review at 1M Scale

| Decision | Still Valid? | Action at 1M |
|----------|--------------|--------------|
| Modular monolith | **Yes (initially)** | Extract workers first, then booking reads |
| PostgreSQL primary | **Yes** | Multi-AZ + read replicas + PgBouncer |
| Redis cache + queue | **Partial** | Split cache/queue clusters |
| JWT stateless auth | **Yes** | Add Redis auth cache + token blocklist |
| Transactional outbox | **Yes** | Replace poller with Kafka at >5K events/s |
| Prisma ORM | **Yes** | Raw SQL for hot reporting paths |

## Phase 1: 100K → 250K Users (Months 1–3)

| Action | Component |
|--------|-----------|
| HPA 3→10 pods | API |
| PgBouncer (transaction mode) | Database connections |
| Read replica for analytics/audit | PostgreSQL |
| Redis auth cache (30s TTL) | JWT validation |
| Redis replication | Cache/queue HA |
| Grafana alert rules | Operations |

**No architecture changes required.**

## Phase 2: 250K → 500K Users (Months 3–6)

| Action | Component |
|--------|-----------|
| Extract notification worker | Separate K8s deployment |
| Materialized views for dashboard | PostgreSQL |
| Elasticsearch for doctor search | Replace ILIKE search |
| Partition `audit_logs` by month | PostgreSQL |
| CDN + API gateway | Edge rate limiting |
| Connection pool per service | PgBouncer pools |

```
                    ┌─────────────┐
                    │ API Gateway │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌──────────────┐
    │ API Pods   │  │ Notification│  │ Analytics    │
    │ (stateless)│  │ Workers     │  │ Worker       │
    └─────┬──────┘  └──────┬─────┘  └──────┬───────┘
          │                │                │
    ┌─────▼──────┐   ┌─────▼─────┐   ┌─────▼──────┐
    │ PostgreSQL │   │ Redis     │   │ Read       │
    │ Primary    │   │ Cluster   │   │ Replica    │
    └────────────┘   └───────────┘   └────────────┘
```

## Phase 3: 500K → 1M Users (Months 6–12)

| Action | Component |
|--------|-----------|
| Kafka replaces outbox poller | Event bus |
| CQRS read models for consultations | Separate read DB |
| Extract booking read service | Read-heavy path |
| Multi-region active-passive | DR region |
| Table partitioning (appointments) | Quarterly partitions |
| Field-level encryption for PHI | Compliance |

## Refactoring Required (Only at Scale)

| Component | Trigger | Refactor |
|-----------|---------|----------|
| `JwtStrategy` | >500 auth RPS | Redis cache layer |
| `DoctorSearchService` | >100 search RPS | Elasticsearch |
| `DashboardService` | >50ms cold query | Materialized views |
| `OutboxPollerService` | >1000 events/s | Kafka consumer |
| `search.service.ts` (admin) | Admin scale | Dedicated search service |

**Do not refactor these prematurely** — current implementation is correct for <250K users.

## Database Scaling

| Technique | When |
|-----------|------|
| Read replicas | >50K consultations/day |
| PgBouncer | >5 API pods |
| Partitioning audit_logs | >10M rows |
| Partitioning appointments | >10M rows |
| Archival to S3 | >7 year retention |

## Redis Scaling

| Phase | Configuration |
|-------|---------------|
| Current | Single instance (dev/small prod) |
| 250K users | Primary + replica |
| 500K users | Separate cache cluster + queue cluster |
| 1M users | Redis Cluster mode, 3+ shards |

## Cost Model (Indicative)

| Scale | API Pods | DB Tier | Redis | Monthly Est. |
|-------|----------|---------|-------|--------------|
| 100K/day | 3 | db.r6g.large | cache.r6g.large | $800–1,200 |
| 500K/day | 10 | db.r6g.2xlarge + replica | cluster | $3,000–5,000 |
| 1M/day | 20+ | db.r6g.4xlarge + 2 replicas | cluster | $8,000–15,000 |

## Monitoring at 1M Scale

| Metric | Alert Threshold |
|--------|-----------------|
| API p95 latency | > 300ms |
| DB connection pool utilization | > 80% |
| Replication lag | > 5s |
| Cache hit ratio | < 70% |
| Outbox/Kafka lag | > 10,000 messages |

## Decision Summary

The current modular monolith architecture **scales to 250K users without structural changes**. Beyond that, extract async workers and read paths first — not the booking write path, which must remain transactional until true distributed transaction tooling (Saga) is justified.

See [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) for microservice extraction criteria.
