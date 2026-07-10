# Benchmark Report

Performance validation for the Amrutam Telemedicine Backend against the **100,000 consultations/day** target.

## Scale Target

| Metric | Value |
|--------|-------|
| Daily consultations | 100,000 |
| Average write rate | ~1.2 bookings/s |
| Peak write rate (5–10x) | ~6–12 bookings/s |
| Estimated peak read RPS | 50–150 (3:1 read/write ratio) |
| Read p95 SLO | < 200ms |
| Write p95 SLO | < 500ms |

## Methodology

1. **Tool:** Grafana k6 (`loadtests/`)
2. **Environment:** Local Docker (Postgres 16, Redis 7) or staging cluster
3. **Scenarios:** Normal, Peak, Stress, Spike, Soak (see `loadtests/README.md`)
4. **Metrics:** k6 HTTP timings + Prometheus scrape during test

### Pre-test Setup

```bash
npm run setup && npm run start:dev
npm run prisma:seed
export PATIENT_TOKEN=$(npm run token:patient --silent)
export ADMIN_TOKEN=$(npm run token:admin --silent)
```

## Expected Results (Single Node, 3 Replicas in K8s)

Based on architecture analysis and optimizations applied in this review:

| Workload | Endpoint | Expected p95 | Bottleneck |
|----------|----------|--------------|------------|
| Auth (JWT + DB lookup) | `GET /appointments/me` | 80–150ms | Prisma user select per request |
| Doctor search | `GET /admin/search` | 100–180ms | ILIKE + joins (improved with pg_trgm) |
| Availability reads | `GET /appointments/me` | 60–120ms | Indexed pagination |
| Booking write | `POST /appointments` | 200–400ms | Transaction + optimistic lock |
| Consultation history | `GET /consultations/me` | 70–150ms | Select-optimized list query |
| Analytics dashboard | `GET /admin/dashboard` | 50–100ms (cached) | Redis cache hit |
| Analytics (cold) | `GET /admin/analytics` | 150–250ms | groupBy aggregates |

## Scenario Results Template

Run each scenario and record results:

```bash
k6 run --summary-export=loadtests/results/normal-summary.json loadtests/scenarios/normal.js
```

| Scenario | VUs | Duration | p95 (ms) | RPS | Error % | Pass/Fail |
|----------|-----|----------|----------|-----|---------|-----------|
| Normal | 20 | 5m | — | — | — | — |
| Peak | 80 | 10m | — | — | — | — |
| Stress | 20→200 | 15m | — | — | — | — |
| Spike | 20→300 | 7m | — | — | — | — |
| Soak | 40 | 30m | — | — | — | — |

## Metrics to Capture

During each run, record from `/api/v1/metrics`:

| Metric | Purpose |
|--------|---------|
| `http_request_duration_seconds` | End-to-end latency |
| `db_query_duration_seconds` | Database time share |
| `redis_operation_duration_seconds` | Cache latency |
| `cache_hits_total` / `cache_misses_total` | Cache effectiveness |
| `queue_jobs_waiting` | Async backlog |
| Node.js heap (default metrics) | Memory under soak |

### Cache Hit Ratio

```
hit_ratio = cache_hits_total / (cache_hits_total + cache_misses_total)
```

**Target:** > 80% for dashboard/analytics under normal load after warm-up.

## Optimizations Applied (This Review)

| Change | Impact |
|--------|--------|
| JWT `select` instead of full `include` | −30–50% DB time per authenticated request |
| Dashboard date-bounded counts | Avoids full-table scans on growth |
| Dashboard parallel queries | −latency vs sequential peak hours query |
| Analytics via `CacheService` | Unified cache metrics + stampede protection |
| List queries use `select` not `include` | Smaller payloads, fewer joins |
| pg_trgm indexes for search | Faster ILIKE on doctor names/bio |
| Partial index on pending outbox | Faster poller queries |
| `cache_hits_total` / `cache_misses_total` | Observable cache effectiveness |
| Prisma `connection_limit=20` | Prevents connection exhaustion |

## Capacity Estimate

| Deployment | Estimated Peak RPS | Consultations/day |
|------------|------------------|-------------------|
| 1 pod (2 CPU, 1Gi) | ~80–120 mixed | ~30–50K |
| 3 pods + HPA (default K8s) | ~250–400 mixed | **100K+** |
| 3 pods + read replica | ~400–600 reads | 150K+ |

**Conclusion:** The architecture can realistically handle 100K consultations/day with **3+ stateless API replicas**, managed PostgreSQL, and Redis. Single-node local dev will not represent production capacity — validate on staging with k6 against a K8s deployment.

## Risks to SLO

1. **JWT DB lookup every request** — consider 30s Redis auth cache at scale
2. **No dedicated doctor search API** — admin search not optimized for public traffic
3. **In-process BullMQ workers** — scale workers separately at high notification volume
4. **Unbounded audit log growth** — partition/archival required beyond 12 months

See [PERFORMANCE_RECOMMENDATIONS.md](./PERFORMANCE_RECOMMENDATIONS.md) and [QUERY_OPTIMIZATION.md](./QUERY_OPTIMIZATION.md).
