-- Performance indexes for analytics, dashboard, and text search workloads.
-- Supports date-bounded aggregate queries and ILIKE doctor search.

CREATE INDEX IF NOT EXISTS "appointments_created_at_idx" ON "appointments"("created_at");
CREATE INDEX IF NOT EXISTS "appointments_cancelled_at_idx" ON "appointments"("cancelled_at") WHERE "cancelled_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "consultations_completed_at_idx" ON "consultations"("completed_at") WHERE "completed_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payments_captured_at_idx" ON "payments"("captured_at") WHERE "captured_at" IS NOT NULL;

-- Partial index for outbox poller hot path
CREATE INDEX IF NOT EXISTS "outbox_events_pending_created_idx"
  ON "outbox_events"("created_at")
  WHERE "status" = 'PENDING';

-- Trigram indexes for admin search (requires pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "doctors_bio_trgm_idx" ON "doctors" USING gin ("bio" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "profiles_first_name_trgm_idx" ON "profiles" USING gin ("first_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "profiles_last_name_trgm_idx" ON "profiles" USING gin ("last_name" gin_trgm_ops);
