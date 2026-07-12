-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_pending_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_recovery_codes" JSONB;
