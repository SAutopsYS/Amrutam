# Database Review

Principal Database Engineer assessment of PostgreSQL schema and data access patterns.

## Schema Overview

39 models, PostgreSQL 16, Prisma ORM. Optimistic locking on high-contention entities. No soft deletes on clinical data.

## Index Strategy

**Tier 1 (hot path):** `availability_slots(doctor_id, start_time, status)`, `booking_idempotency(idempotency_key)`, `appointments(patient_id, status, scheduled_start)`, `outbox_events(status, created_at)`.

**Tier 2 (analytics):** `appointments(created_at)`, `payments(captured_at)`, `consultations(completed_at)` — added in performance migration.

**Tier 3 (search):** pg_trgm GIN indexes on `doctors.bio`, `profiles.first_name/last_name`.

## Foreign Keys

Cascade for child records; SetNull for audit user reference; restrict on appointment-user. Assessment: correct for clinical integrity.

## Transactions

Booking, cancel, and consultation transitions use appropriately scoped transactions. No external HTTP inside transactions.

## Pagination

Cursor-based with `take: limit+1` and max cap of 100. No OFFSET degradation.

## Connection Pool

`DATABASE_URL?connection_limit=20&pool_timeout=10`. Use PgBouncer above 5 pods.

## Partition Strategy (Future)

| Table | Trigger | Strategy |
|-------|---------|----------|
| audit_logs | > 50M rows | Monthly RANGE on created_at |
| appointments | > 10M rows | Quarterly RANGE on scheduled_start |
| outbox_events | Published > 30 days | Archive and delete |

## Retention Strategy

| Data | Retention |
|------|-----------|
| Clinical records | Indefinite |
| Audit logs | 7 years |
| Outbox (published) | 30 days |
| Idempotency keys | 24 hours |
| Dead letter events | 90 days |

## Scalability

Single primary handles ~50 booking writes/s. Read replica recommended above 50K consultations/day for analytics and audit queries.

See [performance/QUERY_OPTIMIZATION.md](performance/QUERY_OPTIMIZATION.md).
