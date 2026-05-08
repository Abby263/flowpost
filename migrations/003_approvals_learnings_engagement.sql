-- ============================================================================
-- FlowPost: Human Approval, Learnings, and Engagement Tracking
-- ============================================================================
-- This migration adds:
--   1. Pending-approval drafts (image + caption stored, awaiting human review)
--   2. post_learnings table to capture what worked / what didn't (manual + automatic)
--   3. post_engagement table for time-series engagement metrics per post
--   4. Meta Graph API fields on connections (so insights sync can authenticate)
--
-- Usage:
--   psql $DATABASE_URI -f migrations/003_approvals_learnings_engagement.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- POSTS: extend status vocabulary + draft fields
-- ----------------------------------------------------------------------------
-- New status values:
--   pending_approval - draft generated, awaiting human review
--   rejected         - reviewer declined, archived for learning
--   approved         - reviewer approved, queued for publish
--   publishing       - publish in progress (transient)

ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS draft_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_posts_pending_approval
  ON posts(user_id, created_at DESC)
  WHERE status = 'pending_approval';

-- ----------------------------------------------------------------------------
-- POST_LEARNINGS
-- Free-form notes learned about what content/style works for a user/workflow.
-- Sources:
--   manual_reject  - reviewer rejected a draft and provided a reason
--   auto_engagement - derived from engagement deltas (top performer, low performer)
--   user_note      - reviewer left a positive note when approving
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN (
    'manual_reject',
    'auto_engagement',
    'user_note'
  )),
  signal TEXT NOT NULL CHECK (signal IN ('positive', 'negative', 'neutral')),
  lesson TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE post_learnings IS 'Things learned about what works for this user/workflow. Fed back into generation prompts.';

CREATE INDEX IF NOT EXISTS idx_post_learnings_user_workflow
  ON post_learnings(user_id, workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_learnings_signal
  ON post_learnings(signal, created_at DESC);

ALTER TABLE post_learnings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- POST_ENGAGEMENT
-- One row per (post, fetched_at) so we can chart growth over time.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  -- Common metrics. Not all platforms expose all fields.
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  -- Raw payload from the platform (debugging / future fields)
  raw JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE post_engagement IS 'Time-series engagement metrics per published post.';

CREATE INDEX IF NOT EXISTS idx_post_engagement_post_id
  ON post_engagement(post_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_user_id
  ON post_engagement(user_id, fetched_at DESC);

ALTER TABLE post_engagement ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- CONNECTIONS: Meta Graph API extras
-- Stored as new top-level columns (kept separate from credentials JSON so the
-- insights cron can find them without reaching into nested payloads).
-- ----------------------------------------------------------------------------
ALTER TABLE connections ADD COLUMN IF NOT EXISTS graph_access_token TEXT;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS ig_business_account_id TEXT;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS graph_token_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN connections.graph_access_token IS 'Long-lived Meta Graph API access token (Instagram Business/Creator). Optional.';
COMMENT ON COLUMN connections.ig_business_account_id IS 'Instagram Graph API business account ID. Optional.';

-- ----------------------------------------------------------------------------
-- WORKFLOWS: track scheduling + last cron run
-- ----------------------------------------------------------------------------
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN workflows.last_run_at IS 'Last time the workflow was triggered (manual or cron).';
COMMENT ON COLUMN workflows.next_run_at IS 'Next scheduled run, computed from frequency.';

CREATE INDEX IF NOT EXISTS idx_workflows_due
  ON workflows(next_run_at)
  WHERE is_active = true AND next_run_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'FlowPost approvals/learnings/engagement migration applied.';
END $$;
