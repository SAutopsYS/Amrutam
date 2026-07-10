# Disaster Recovery

Recovery objectives and runbooks for the Amrutam telemedicine platform.

## Recovery Objectives

| Scenario | RPO | RTO | Notes |
|----------|-----|-----|-------|
| Single AZ failure | 0 (multi-AZ) | 15 min | Managed DB failover |
| Database corruption | 5 min (PITR) | 60 min | Restore from WAL |
| Redis loss | 1 hour | 30 min | Cache rebuild; queue replay from outbox |
| Full region outage | 30 min | 4 hours | Cross-region standby |
| Application bug (bad deploy) | 0 | 15 min | Kubernetes rollback |

**RPO** = Recovery Point Objective (max acceptable data loss)  
**RTO** = Recovery Time Objective (max acceptable downtime)

## Incident Classification

| Severity | Example | Response |
|----------|---------|----------|
| SEV-1 | API down, bookings failing | Immediate, all hands |
| SEV-2 | Degraded performance, partial outage | 30 min response |
| SEV-3 | Non-critical feature broken | Next business day |

## Database Restore

### Managed PostgreSQL Failover

1. Confirm primary instance health in cloud console
2. Trigger manual failover if automatic failover did not occur
3. Verify new primary endpoint
4. Update Kubernetes Secret `DATABASE_URL` if endpoint changed
5. Rolling restart API pods: `kubectl rollout restart deployment/amrutam-backend -n amrutam`

### Point-in-Time Recovery

1. Determine corruption timestamp (from audit logs / monitoring)
2. Create new DB instance restored to `T-5min` before incident
3. Validate data integrity on restored instance
4. Blue/green cutover:
   - Update Secret with new `DATABASE_URL`
   - `kubectl rollout restart deployment/amrutam-backend -n amrutam`
   - Monitor `/api/v1/health/ready` and booking metrics
5. Decommission corrupted instance after 48h retention

## Redis Recovery

Redis failure impacts caching, rate limiting, and job queues — **not** authoritative data (PostgreSQL is source of truth).

1. **Assess**: check `/api/v1/health/ready` — `redis` and `queue` indicators
2. **Provision** new Redis instance (or fail over to replica)
3. **Update** `REDIS_HOST` in ConfigMap/Secret
4. **Restart** API pods
5. **Replay** missed events via outbox poller (events remain in PostgreSQL `outbox_events`)
6. **Warm** critical caches (doctor search, dashboard) via admin endpoints or background job

## Application Recovery

### Pod / Node Failure

Kubernetes self-heals via Deployment replicas and HPA. Verify:

```bash
kubectl get pods -n amrutam
kubectl describe pod <pod> -n amrutam
kubectl logs deployment/amrutam-backend -n amrutam --tail=100
```

### Full Application Redeploy

```bash
kubectl apply -k infra/k8s/
kubectl rollout status deployment/amrutam-backend -n amrutam
```

### Docker Compose (local / DR sandbox)

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Deployment Rollback

### Kubernetes

```bash
# Immediate rollback to previous revision
kubectl rollout undo deployment/amrutam-backend -n amrutam

# Rollback to specific revision
kubectl rollout history deployment/amrutam-backend -n amrutam
kubectl rollout undo deployment/amrutam-backend -n amrutam --to-revision=3
```

### CI/CD

- Re-deploy the last known-good image tag from container registry
- GitHub Actions: re-run the successful `docker-build` workflow on the previous commit tag

## Communication

1. Page on-call via PagerDuty/Opsgenie
2. Open incident channel (#incident-YYYYMMDD)
3. Update status page every 30 minutes during SEV-1
4. Post-mortem within 5 business days (blameless)

## DR Testing Schedule

| Test | Frequency | Owner |
|------|-----------|-------|
| Backup restore to staging | Monthly | Platform |
| PITR drill | Quarterly | Platform + DBA |
| Redis failover | Quarterly | Platform |
| Full region failover | Annually | Platform + Security |
| Rollback drill | Monthly | Engineering |

## Dependencies

| Service | Fallback |
|---------|----------|
| PostgreSQL | Multi-AZ + PITR |
| Redis | Replica + outbox replay |
| Payment provider | Queue retries + manual reconciliation |
| Notification provider | DLQ replay (`dead_letter_events`) |

See [Backup Strategy](./backup.md) for retention and snapshot procedures.
