# Load Testing — Amrutam Backend

[k6](https://k6.io/) load tests validating the **100,000 consultations/day** scale target.

## SLO Targets

| Metric | Target |
|--------|--------|
| Read p95 latency | < 200ms |
| Write p95 latency | < 500ms |
| Error rate (normal) | < 1% |
| Error rate (peak) | < 2% |

## Prerequisites

1. [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)
2. Running API + Postgres + Redis
3. JWT tokens from `npm run token:patient`
4. Export `PATIENT_TOKEN`, `ADMIN_TOKEN`, `DOCTOR_ID`, `SLOT_ID`

## Run

```bash
k6 run loadtests/smoke.js
k6 run loadtests/scenarios/normal.js
k6 run loadtests/scenarios/peak.js
```

## Reports

- [BENCHMARK_REPORT.md](../docs/performance/BENCHMARK_REPORT.md)
- [QUERY_OPTIMIZATION.md](../docs/performance/QUERY_OPTIMIZATION.md)
