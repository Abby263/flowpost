-- Migration: Add run tracking columns to workflows table
-- Purpose: Enable concurrency control and prevent duplicate workflow runs
-- Run this in Supabase SQL Editor if you have an existing database

-- Add run tracking columns
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS current_run_id TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS run_status TEXT DEFAULT 'idle';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS run_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Add constraint for run_status (only if column exists and constraint doesn't)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflows_run_status_check'
  ) THEN
    ALTER TABLE workflows ADD CONSTRAINT workflows_run_status_check 
      CHECK (run_status IN ('idle', 'running', 'completed', 'failed'));
  END IF;
END $$;

-- Add index for finding running workflows quickly
CREATE INDEX IF NOT EXISTS idx_workflows_run_status ON workflows(run_status) WHERE run_status = 'running';

-- Update existing workflows to have 'idle' status
UPDATE workflows SET run_status = 'idle' WHERE run_status IS NULL;

-- Add comments
COMMENT ON COLUMN workflows.current_run_id IS 'LangGraph run ID for the currently executing run';
COMMENT ON COLUMN workflows.run_status IS 'Current execution status: idle, running, completed, failed';
COMMENT ON COLUMN workflows.run_started_at IS 'When the current/last run started';
COMMENT ON COLUMN workflows.run_completed_at IS 'When the last run completed';
COMMENT ON COLUMN workflows.last_error IS 'Error message from the last failed run';

-- Function to automatically reset stale running workflows (runs stuck for > 10 minutes)
-- This handles edge cases where the completion callback fails
CREATE OR REPLACE FUNCTION reset_stale_workflows()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE workflows 
  SET 
    run_status = 'failed',
    last_error = 'Workflow timed out (exceeded 10 minute limit)',
    run_completed_at = NOW()
  WHERE 
    run_status = 'running' 
    AND run_started_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_stale_workflows IS 'Resets workflows stuck in running state for > 10 minutes. Call periodically via cron.';

