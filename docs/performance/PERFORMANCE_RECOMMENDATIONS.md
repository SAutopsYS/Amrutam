# Performance Recommendations

Prioritized actions for meeting **100K consultations/day** with **read p95 < 200ms** and **write p95 < 500ms**.

## P0 — Before Production Launch

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Run k6 peak scenario against 3-pod K8s staging | Low | Validates SLO |
| 2 | Apply performance index migration | Low | Faster search + dashboard |
| 3 | Set `connection_limit` per pod in DATABASE_URL | Low | Prevents pool exhaustion |
| 4 | Configure PgBouncer when pods > 5 | Medium | Connection scaling |
| 5 | Enable managed PostgreSQL Multi-AZ + read replica | Medium | Read offload |

## P1 — Within 30 Days of Launch

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 6 | Redis auth cache (30s TTL) for JWT validation | Medium | −50% auth DB queries |
| 7 | Dedicated `GET /doctors/search` public endpoint with cache | Medium | Removes admin search bottleneck |
| 8 | Dedicated `GET /doctors/:id/slots` availability endpoint | Medium | Proper availability testing |
| 9 | Extract BullMQ workers to separate deployment | Medium | Independent worker scaling |
| 10 | Grafana dashboards for p95 latency + cache hit ratio | Low | Operational visibility |

## P2 — Growth Phase (100K–500K/day)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 11 | Materialized views for dashboard/analytics | High | Sub-50ms admin reads |
| 12 | Extract search to Elasticsearch/OpenSearch | High | Full-text at scale |
| 13 | Partition `audit_logs` by month | High | Query + storage performance |
| 14 | CQRS read models for consultation history | High | Independent read scaling |
| 15 | Table partitioning for `appointments` by quarter | High | Archival + query speed |

## Redis Recommendations

| Setting | Value | Reason |
|---------|-------|--------|
| `maxmemory-policy` | `allkeys-lru` | Cache eviction under pressure |
| AOF persistence | `appendonly yes` | Queue durability |
| Separate instances | Cache vs Queue | Noisy neighbor isolation |
| Monitor `cache_hits_total / (hits+misses)` | Target > 80% | Dashboard/analytics effectiveness |

## Application Tuning

| Parameter | Current | Recommended (Production) |
|-----------|---------|--------------------------|
| `THROTTLE_LIMIT` | 100 | 200–500 behind CDN |
| `CACHE_DEFAULT_TTL_SECONDS` | 60 | 60–120 for dashboard |
| `connection_limit` | 20 | 10–15 per pod with PgBouncer |
| HPA max replicas | 20 | Validate with k6 stress test |
| `terminationGracePeriodSeconds` | 60 | Keep — supports graceful drain |

## Load Test Cadence

| Test | Frequency |
|------|-----------|
| Smoke (`loadtests/smoke.js`) | Every deploy |
| Normal | Weekly |
| Peak | Monthly |
| Stress | Quarterly |
| Soak | Quarterly |

## What NOT to Optimize Yet

- Microservice extraction — premature at current scale
- Custom serialization — JSON via NestJS is sufficient
- Read-through cache on booking writes — correctness risk
- Removing audit logging — compliance requirement
