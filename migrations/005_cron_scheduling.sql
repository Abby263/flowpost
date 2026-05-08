-- ============================================================================
-- FlowPost: Cron-expression scheduling + timezone per workflow
-- ============================================================================
-- Today every workflow effectively runs once per cadence bucket (daily/weekly).
-- This migration adds proper cron-expression scheduling with IANA timezone
-- support, so a user can say "Mon-Fri at 9:00 AM America/New_York" and have
-- it actually fire at that local time.
--
-- New columns:
--   cron_expression  - 5-field cron string (e.g. "0 9 * * 1-5"). NULL falls
--                      back to frequency-derived schedule.
--   timezone         - IANA tz identifier (e.g. "America/New_York"). Default
--                      "UTC". Validated by cron-parser at write time, not in
--                      SQL.
--   scheduling_mode  - 'cron' | 'frequency'. 'cron' uses cron_expression,
--                      'frequency' falls back to the daily/weekly/monthly
--                      buckets. We keep both so the UI can offer a simple
--                      and an advanced mode.
--
-- next_run_at and last_run_at already exist (added in migration 003). The
-- scheduler reads next_run_at and ignores it for sub-5-minute precision.
--
-- Usage:
--   psql $DATABASE_URI -f migrations/005_cron_scheduling.sql
-- ============================================================================

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS cron_expression TEXT;

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS scheduling_mode TEXT NOT NULL DEFAULT 'frequency'
    CHECK (scheduling_mode IN ('cron', 'frequency'));

COMMENT ON COLUMN workflows.cron_expression IS '5-field cron expression (e.g. "0 9 * * 1-5"). When scheduling_mode = ''cron'', this drives next_run_at.';
COMMENT ON COLUMN workflows.timezone IS 'IANA timezone identifier. Default UTC. Validated by cron-parser at write time.';
COMMENT ON COLUMN workflows.scheduling_mode IS 'Either "cron" (uses cron_expression) or "frequency" (uses frequency column).';

-- Backfill next_run_at = NOW() so the first sweep picks up existing workflows
-- that don't yet have a computed next_run_at.
UPDATE workflows
   SET next_run_at = NOW()
 WHERE is_active = TRUE AND next_run_at IS NULL;

DO $$
BEGIN
  RAISE NOTICE 'Migration 005 applied. cron_expression / timezone / scheduling_mode added.';
END $$;
