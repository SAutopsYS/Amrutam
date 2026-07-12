# Operations Runbook

Operational procedures for deploying, scaling, recovering, and troubleshooting the Amrutam Telemedicine Backend.

Related: [backup.md](operations/backup.md) · [disaster-recovery.md](operations/disaster-recovery.md) · [platform-engineering.md](platform-engineering.md)

---

## Deployment

### Local (Docker Compose)

```bash
npm run setup                    # Bootstrap env, infra, migrations
npm run docker:up                # Full stack
kubectl apply -k infra/k8s/      # Not needed locally
```

### Kubernetes

**Prerequisites:** Cluster 1.28+, ingress controller, PostgreSQL and Redis reachable from cluster.

```bash
# 1. Configure secrets (never commit real values)
kubectl apply -f infra/k8s/secret.yaml -n amrutam

# 2. Deploy all manifests
kubectl apply -k infra/k8s/

# 3. Verify rollout
kubectl rollout status deployment/amrutam-backend -n amrutam
kubectl get pods -n amrutam
```

**Rolling update** (zero-downtime with readiness probes):

```bash
kubectl set image deployment/amrutam-backend \
  api=ghcr.io/amrutam/amrutam-backend:v1.2.0 -n amrutam
kubectl rollout status deployment/amrutam-backend -n amrutam
```

Deployment uses `maxUnavailable: 0`, `maxSurge: 1`, 60s termination grace, and a 10s preStop hook.

### Database Migrations

Production Docker entrypoint runs `prisma migrate deploy` before starting the app (`docker/entrypoint.sh`).

Manual migration:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Never run `prisma migrate dev` against production.

---

## Rollback

### Kubernetes (fastest)

```bash
kubectl rollout undo deployment/amrutam-backend -n amrutam
kubectl rollout history deployment/amrutam-backend -n amrutam
kubectl rollout undo deployment/amrutam-backend -n amrutam --to-revision=3
```

### Docker Compose

```bash
docker compose -f docker/docker-compose.yml down
git checkout <previous-tag>
docker compose -f docker/docker-compose.yml up --build -d
```

### Database rollback

Schema rollbacks require a forward migration — Prisma does not support automatic down migrations in production. Restore from snapshot if a migration caused data corruption (see Recovery section).

---

## Scaling

### Horizontal (API)

HPA scales 3–20 replicas based on CPU (70%) and memory (80%):

```bash
kubectl get hpa amrutam-backend -n amrutam
kubectl scale deployment/amrutam-backend --replicas=5 -n amrutam  # Manual override
```

API pods are stateless — scale freely. Ensure PostgreSQL connection pool (PgBouncer) handles increased connections.

### Vertical (resources)

Edit `infra/k8s/deployment.yaml` resource requests/limits and re-apply.

### Redis / PostgreSQL

Scale data tier via cloud console or Terraform modules. See [infra/terraform/README.md](../infra/terraform/README.md).

---

## Backup

Full procedures: [operations/backup.md](operations/backup.md).

| Component | Method | Frequency |
|-----------|--------|-----------|
| PostgreSQL | Managed snapshots + WAL/PITR | Daily + continuous |
| Redis | RDB + AOF | Hourly RDB |
| Config | Git + K8s ConfigMap versioning | Every deploy |

**Verify backups monthly** by restoring to staging and running integration tests.

---

## Recovery

Full procedures: [operations/disaster-recovery.md](operations/disaster-recovery.md).

| Scenario | RPO | RTO | Action |
|----------|-----|-----|--------|
| Pod crash | 0 | < 1 min | Kubernetes auto-restart |
| AZ failure | 0 | 15 min | Managed DB failover |
| DB corruption | 5 min | 60 min | PITR to new instance |
| Bad deploy | 0 | 15 min | `kubectl rollout undo` |
| Redis loss | 1 hour | 30 min | Restore + outbox replay |

### Database restore (summary)

1. Identify recovery point (timestamp or snapshot)
2. Provision new instance from snapshot/PITR
3. Validate: `npx prisma migrate status`
4. Update `DATABASE_URL` in Secret
5. Rolling restart: `kubectl rollout restart deployment/amrutam-backend -n amrutam`

### Dead letter replay

Failed events land in `dead_letter_events`. Inspect via admin tools or direct DB query. `DeadLetterService.replay()` can re-enqueue events (admin endpoint planned for future).

---

## Common Failures

### 503 on `/api/v1/health/ready`

**Cause:** PostgreSQL or Redis unreachable.

**Fix:**
```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
# K8s: check postgres/redis pod status and NetworkPolicy
kubectl get pods -n amrutam
kubectl logs deployment/amrutam-backend -n amrutam --tail=50
```

### 409 `SLOT_ALREADY_BOOKED`

**Cause:** Concurrent booking on the same slot (expected behavior).

**Fix:** Client retries with a different slot. Not an operational incident.

### 409 `IDEMPOTENCY_CONFLICT`

**Cause:** Same `Idempotency-Key` with different request body.

**Fix:** Client must use a new idempotency key for a different booking attempt.

### Queue backlog growing

**Cause:** Notification provider down or worker overwhelmed.

**Fix:**
1. Check `GET /api/v1/admin/system-health` for DLQ metrics
2. Verify Redis connectivity
3. Check external notification provider status
4. Scale API pods (workers run in-process)
5. Inspect `dead_letter_events` table

### Prisma migration failure on startup

**Cause:** Schema drift or failed partial migration.

**Fix:**
```bash
npx prisma migrate status
npx prisma migrate resolve --applied <migration_name>  # if already applied manually
```

### JWT validation failures (401)

**Cause:** Expired token, wrong secret, or clock skew.

**Fix:** Verify `JWT_ACCESS_SECRET` matches across pods. Check token expiry. Re-issue token.

### High memory / OOM kill

**Cause:** Memory leak or insufficient limits.

**Fix:** Check `MAX_HEAP_USED_MB` health indicator. Increase memory limits in deployment. Review slow query logs.

---

## Troubleshooting Checklist

```
□ Is the pod running?          kubectl get pods -n amrutam
□ Are probes passing?          curl /api/v1/health/ready
□ Is Postgres reachable?       kubectl exec ... -- pg_isready
□ Is Redis reachable?          redis-cli ping
□ Any errors in logs?          kubectl logs deployment/amrutam-backend
□ Queue depth normal?          curl /api/v1/admin/system-health
□ Recent deploy?               kubectl rollout history
□ Correlation ID traced?       Search logs/Jaeger by X-Correlation-Id
```

---

## On-Call Escalation

| Severity | Action |
|----------|--------|
| SEV-1 (API down, data breach) | Page on-call → incident channel → rollback → post-mortem |
| SEV-2 (degraded, partial outage) | Investigate logs/traces → scale or rollback |
| SEV-3 (non-critical) | Ticket for next sprint |

---

## Related Documents

- [Observability Guide](observability.md)
- [Security Policy](../SECURITY.md)
- [Kubernetes README](../infra/k8s/README.md)
- [Platform Engineering](platform-engineering.md)
