# Query Optimization Report

Database performance analysis for the Amrutam backend (PostgreSQL 16 + Prisma).

## Index Review

### Existing Indexes (Strong)

The schema already indexes high-contention paths well:

| Table | Index | Query Pattern |
|-------|-------|---------------|
| `availability_slots` | `(doctor_id, start_time, status)` | Slot lookup + booking |
| `availability_slots` | `(status, start_time)` | Available slot scans |
| `appointments` | `(patient_id, status, scheduled_start DESC)` | Patient list |
| `appointments` | `(doctor_id, status, scheduled_start DESC)` | Doctor list |
| `consultations` | `(patient_id, status, created_at DESC)` | History list |
| `outbox_events` | `(status, created_at)` | Poller |
| `booking_idempotency` | `(idempotency_key)` UNIQUE | Idempotency check |
| `audit_logs` | `(created_at DESC)` | Audit queries |

### Indexes Added (Migration `20250710120000_performance_indexes`)

| Index | Purpose |
|-------|---------|
| `appointments(created_at)` | Dashboard daily counts |
| `appointments(cancelled_at) WHERE cancelled_at IS NOT NULL` | Partial cancel metrics |
| `consultations(completed_at) WHERE completed_at IS NOT NULL` | Daily completion counts |
| `payments(captured_at) WHERE captured_at IS NOT NULL` | Revenue aggregates |
| `outbox_events(created_at) WHERE status = 'PENDING'` | Hot poller path |
| `doctors(bio) GIN trgm` | ILIKE search |
| `profiles(first_name, last_name) GIN trgm` | Name search |

## Query Plan Analysis

### Booking Transaction (Hot Write Path)

```
1. SELECT booking_idempotency WHERE key = ?     → Index scan (unique)
2. BEGIN
3. INSERT booking_idempotency                   → Unique index
4. SELECT availability_slots FOR UPDATE          → PK scan + row lock
5. UPDATE availability_slots WHERE version = ?   → Optimistic lock (index on PK)
6. INSERT appointment, booking, history, audit, outbox
7. COMMIT
```

**Assessment:** Efficient. Optimistic locking avoids long-held row locks. Transaction scope is appropriate — all writes must be atomic.

**Recommendation:** Keep transactions short. Do not add external HTTP calls inside transactions.

### JWT Validation (Hot Read Path — Every Request)

```sql
SELECT users.*, roles, doctor WHERE id = ?
```

**Before optimization:** Full `include` with profile (unused for auth).

**After optimization:** `select` only `id, email, status, roles.name, doctor.id`. Rejects non-ACTIVE users.

**Estimated improvement:** 30–50% less data transferred per auth check.

### Dashboard Aggregates

**Before:** `completedConsultations` and `cancelledAppointments` counted entire table. Peak hours query ran sequentially after parallel batch.

**After:** Date-bounded `WHERE completed_at >= today` and `cancelled_at >= today`. All 11 queries parallelized.

### List Pagination (Appointments, Consultations)

**Pattern:** Cursor-based (`take: limit+1`, `cursor: { id }`, `skip: 1`).

**Assessment:** Correct — avoids OFFSET degradation at depth.

**Optimization applied:** Replaced `include` with explicit `select` to reduce join width on list endpoints.

### Search (Admin Global Search)

**Risk:** `ILIKE '%keyword%'` on `doctors.bio` and `profiles.first_name` without trigram index causes sequential scans.

**Mitigation:** pg_trgm GIN indexes added. For production scale, consider Elasticsearch/OpenSearch extraction (documented in architecture audit).

## N+1 Query Review

| Location | Status |
|----------|--------|
| `appointment.repository.findMany` | No N+1 — single query with nested select |
| `consultation.repository.findMany` | No N+1 — single query with nested select |
| `consultation.repository.findById` | Single query with includes (detail view — acceptable) |
| `search.service.globalSearch` | No N+1 — but runs up to 4 sequential queries per type |
| `JwtStrategy.validate` | Single query per request |

## Connection Pool

Configure in `DATABASE_URL`:

```
?connection_limit=20&pool_timeout=10
```

| Pods | Connections per pod | Total | Recommendation |
|------|---------------------|-------|----------------|
| 3 | 20 | 60 | OK for db.r6g.large |
| 10 | 20 | 200 | Use PgBouncer |

**Rule:** `max_connections` on PostgreSQL > (pods × connection_limit) + admin overhead.

## Transaction Review

| Operation | Isolation | Assessment |
|-----------|-----------|------------|
| Create booking | Read Committed (default) | Correct |
| Cancel/reschedule | Single transaction | Correct |
| Outbox write | Same tx as booking | Correct |
| Consultation state change | Single transaction | Correct |

## Batch Operations

| Area | Current | Recommendation |
|------|---------|------------------|
| Outbox poller | Batch poll (interval) | Increase batch size at scale |
| Dashboard | 11 parallel counts | Materialized view at >1M rows |
| Analytics groupBy | 4 parallel queries | Acceptable with cache |
| Audit log insert | Single row | Batch only if high-volume automation |

## Pagination Limits

All list endpoints cap at `Math.min(limit, 100)` — prevents unbounded result sets.

## Apply Migration

```bash
npx prisma migrate deploy
```

Verify indexes:

```sql
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename;
```
