# Backup Strategy

Operational backup procedures for the Amrutam telemedicine platform.

## Scope

| Component | Backup Method | Frequency |
|-----------|---------------|-----------|
| PostgreSQL | Automated snapshots + WAL archiving | Daily full, continuous WAL |
| Redis | RDB snapshots + AOF (if persistence enabled) | Hourly RDB, continuous AOF |
| Application config | Git + ConfigMap/Secret versioning | On every deploy |
| Audit logs | PostgreSQL (included in DB backup) | Continuous |

## PostgreSQL

### Daily Backups

- Enable **automated daily snapshots** on managed PostgreSQL (RDS, Cloud SQL, Azure Database)
- Retain snapshots per retention policy (see below)
- Verify backup completion via cloud monitoring alerts

### Point-in-Time Recovery (PITR)

- Enable **WAL archiving** / transaction log shipping
- PITR window: minimum **7 days** (production: **30 days** recommended)
- Test PITR quarterly in staging

```bash
# Example: restore to a specific timestamp (provider-specific)
# AWS RDS: restore-db-instance-to-point-in-time
# Cloud SQL: gcloud sql backups restore --point-in-time
```

### Manual Backup (on-demand)

```bash
pg_dump -Fc -h $PGHOST -U amrutam -d amrutam -f amrutam-$(date +%Y%m%d).dump
```

Store dumps in encrypted object storage (S3/GCS) with lifecycle policies.

## Redis

Redis holds **ephemeral cache and queue data**. Backup strategy depends on durability requirements:

| Data Type | Criticality | Backup |
|-----------|-------------|--------|
| Session cache | Low | Rebuild on miss |
| Rate limit counters | Low | Accept loss |
| BullMQ job queues | Medium | AOF persistence + snapshot |
| Idempotency keys | Medium | TTL-bound; accept short loss |

### Configuration

- Enable **AOF** (`appendonly yes`) for queue durability
- Schedule **RDB snapshots** every hour
- Use Redis replication (primary + replica) for HA

## Retention Policy

| Backup Type | Dev | Staging | Production |
|-------------|-----|---------|------------|
| Daily DB snapshots | 3 days | 7 days | 30 days |
| PITR window | 1 day | 7 days | 30 days |
| Manual dumps | 7 days | 14 days | 90 days |
| Redis RDB | 1 day | 3 days | 7 days |

## Restore Process

### Database Restore

1. **Identify** target recovery point (timestamp or snapshot ID)
2. **Provision** a new database instance from snapshot/PITR (never overwrite production directly)
3. **Validate** schema version: `npx prisma migrate status`
4. **Run smoke tests** against restored instance
5. **Switch** application `DATABASE_URL` (blue/green or maintenance window)
6. **Verify** health endpoints and critical flows (auth, booking)

### Redis Restore

1. Stop workers to prevent duplicate job processing
2. Restore RDB/AOF to a new Redis instance
3. Update `REDIS_HOST` in ConfigMap/Secret
4. Restart API pods and verify queue health at `/api/v1/health/ready`

## Verification

- **Monthly**: restore latest snapshot to staging and run integration tests
- **Quarterly**: full PITR drill with documented RTO/RPO results
- Alert on backup job failures within 15 minutes

## Encryption

- Encrypt snapshots at rest (cloud default or CMK)
- Encrypt manual dumps before upload (GPG or SSE-KMS)
- Restrict backup bucket access to break-glass IAM roles

See [Disaster Recovery](./disaster-recovery.md) for RPO/RTO targets and full recovery runbooks.
