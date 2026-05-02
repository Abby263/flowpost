-- ============================================================================
-- FlowPost Database Schema for Supabase/Postgres
-- ============================================================================
-- This migration creates the complete database schema for FlowPost
-- Run this against Supabase Postgres or local Postgres
--
-- Usage:
--   psql $DATABASE_URI -f migrations/001_initial_schema.sql
-- ============================================================================

-- Note: Using gen_random_uuid() which is built-in to PostgreSQL 13+
-- No extension required

-- ============================================================================
-- CONNECTIONS TABLE
-- Stores social media platform credentials
-- ============================================================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'slack')),
  profile_name TEXT,
  credentials JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE connections IS 'Social media platform credentials for each user';

-- ============================================================================
-- WORKFLOWS TABLE
-- Stores automated workflow configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT,
  platform TEXT,
  config JSONB,
  search_query TEXT,
  location TEXT,
  style_prompt TEXT,
  schedule TEXT,
  frequency TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Run tracking fields for concurrency control
  current_run_id TEXT,
  run_status TEXT DEFAULT 'idle' CHECK (run_status IN ('idle', 'running', 'completed', 'failed')),
  run_started_at TIMESTAMP WITH TIME ZONE,
  run_completed_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT
);

COMMENT ON TABLE workflows IS 'Automated content workflow configurations';
COMMENT ON COLUMN workflows.current_run_id IS 'LangGraph run ID for the currently executing run';
COMMENT ON COLUMN workflows.run_status IS 'Current execution status: idle, running, completed, failed';
COMMENT ON COLUMN workflows.run_started_at IS 'When the current/last run started';
COMMENT ON COLUMN workflows.run_completed_at IS 'When the last run completed';
COMMENT ON COLUMN workflows.last_error IS 'Error message from the last failed run';

-- ============================================================================
-- POSTS TABLE
-- Tracks all posts and their history
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  content TEXT,
  platform TEXT,
  status TEXT DEFAULT 'draft',
  source TEXT DEFAULT 'workflow',
  image_url TEXT,
  published_url TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE posts IS 'All posts created through FlowPost';
COMMENT ON COLUMN posts.status IS 'Values: draft, scheduled, published, failed, pending';
COMMENT ON COLUMN posts.source IS 'Values: workflow, manual, trending, ai-generated';

-- ============================================================================
-- PLANS TABLE
-- Define subscription tiers and their limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Pricing
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  -- Limits
  credits_per_month INTEGER NOT NULL DEFAULT 0,
  max_workflows INTEGER NOT NULL DEFAULT 1,
  max_connections INTEGER NOT NULL DEFAULT 1,
  -- Features (JSON for flexibility)
  features JSONB DEFAULT '[]'::jsonb,
  -- Meta
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE plans IS 'Subscription plan definitions with pricing and limits';

-- Insert default plans
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, credits_per_month, max_workflows, max_connections, features, sort_order) VALUES
  ('Free', 'free', 'Get started with FlowPost', 0, 0, 10, 1, 1, 
   '["10 AI generations/month", "1 workflow", "1 social connection", "Basic support"]'::jsonb, 1),
  ('Starter', 'starter', 'Perfect for creators', 19, 190, 100, 5, 3, 
   '["100 AI generations/month", "5 workflows", "3 social connections", "Priority support", "Analytics dashboard"]'::jsonb, 2),
  ('Pro', 'pro', 'For growing businesses', 49, 490, 500, 20, 10, 
   '["500 AI generations/month", "20 workflows", "10 social connections", "Priority support", "Advanced analytics", "Custom branding", "API access"]'::jsonb, 3),
  ('Enterprise', 'enterprise', 'Unlimited power for teams', 149, 1490, 2000, -1, -1, 
   '["2000 AI generations/month", "Unlimited workflows", "Unlimited connections", "Dedicated support", "Custom integrations", "Team collaboration", "SLA guarantee"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- USER_SUBSCRIPTIONS TABLE
-- Track user subscription status
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  -- Dates
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_subscriptions IS 'User subscription status and Stripe integration';

-- ============================================================================
-- USER_CREDITS TABLE
-- Track user credit balance and usage
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  -- Balance
  credits_balance INTEGER NOT NULL DEFAULT 0,
  credits_used_this_month INTEGER NOT NULL DEFAULT 0,
  -- Bonus credits (one-time purchases or promotions)
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  -- Reset tracking
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_credits IS 'User credit balance and usage tracking';

-- ============================================================================
-- CREDIT_TRANSACTIONS TABLE
-- Audit trail for all credit changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  -- Transaction details
  amount INTEGER NOT NULL, -- positive for additions, negative for deductions
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'subscription_credit', -- Monthly credit allocation
    'usage',              -- Workflow execution
    'deduction',          -- Generic deduction
    'purchase',           -- One-time credit purchase
    'bonus',              -- Promotional credits
    'refund',             -- Credit refund
    'adjustment'          -- Manual adjustment
  )),
  -- Reference
  reference_type TEXT, -- 'workflow', 'post', 'payment', etc.
  reference_id TEXT,   -- ID of the related entity
  description TEXT,
  -- Meta
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit changes';

-- ============================================================================
-- CREDIT_PACKAGES TABLE
-- One-time credit purchase options
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stripe_price_id TEXT,
  -- Bonus credits for larger packages
  bonus_credits INTEGER DEFAULT 0,
  -- Meta
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default credit packages
INSERT INTO credit_packages (name, credits, price, bonus_credits, sort_order) VALUES
  ('Starter Pack', 50, 9.99, 0, 1),
  ('Growth Pack', 150, 24.99, 15, 2),
  ('Power Pack', 500, 69.99, 75, 3),
  ('Enterprise Pack', 2000, 199.99, 500, 4)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COST_TRACKING TABLE
-- Track all external service costs (AI APIs, infrastructure, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Service identification
  service TEXT NOT NULL, -- 'openai', 'anthropic', 'gemini', 'firecrawl', etc.
  service_type TEXT NOT NULL CHECK (service_type IN (
    'ai_model',           -- LLM API calls
    'image_generation',   -- Image generation APIs
    'web_scraping',       -- Firecrawl, etc.
    'infrastructure',     -- Server, database costs
    'storage',            -- File storage
    'other'               -- Miscellaneous
  )),
  -- Cost details
  amount DECIMAL(10, 4) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  -- Usage metrics
  tokens_input INTEGER,
  tokens_output INTEGER,
  api_calls INTEGER DEFAULT 1,
  -- Reference
  user_id TEXT,           -- If cost is attributable to a specific user
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  reference_type TEXT,    -- 'workflow_run', 'post_generation', etc.
  reference_id TEXT,
  -- Meta
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cost_tracking IS 'Detailed log of all external service costs';

-- ============================================================================
-- MONTHLY_COST_SUMMARY TABLE
-- Aggregated monthly costs for quick reporting
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_cost_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  service TEXT NOT NULL,
  service_type TEXT NOT NULL,
  -- Aggregated data
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_input BIGINT DEFAULT 0,
  total_tokens_output BIGINT DEFAULT 0,
  -- Unique users who incurred costs
  unique_users INTEGER DEFAULT 0,
  -- Meta
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year_month, service, service_type)
);

COMMENT ON TABLE monthly_cost_summary IS 'Aggregated monthly cost data for reporting';

-- ============================================================================
-- INDEXES
-- For faster query performance
-- ============================================================================

-- Connections indexes
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_run_status ON workflows(run_status) WHERE run_status = 'running';

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_workflow_id ON posts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- Credits indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Cost tracking indexes
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service ON cost_tracking(service);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service_type ON cost_tracking(service_type);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_summary_year_month ON monthly_cost_summary(year_month DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- The application uses server-side database access through DATABASE_URI.
-- RLS is enabled to prevent accidental table exposure through Supabase APIs.
-- ============================================================================

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cost_summary ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to reset stale running workflows (runs stuck for > 10 minutes)
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

COMMENT ON FUNCTION reset_stale_workflows IS 'Resets workflows stuck in running state for > 10 minutes';

-- Function to update monthly cost summary (run via scheduled job)
CREATE OR REPLACE FUNCTION update_monthly_cost_summary()
RETURNS void AS $$
BEGIN
  INSERT INTO monthly_cost_summary (year_month, service, service_type, total_amount, total_api_calls, total_tokens_input, total_tokens_output, unique_users, updated_at)
  SELECT 
    to_char(created_at, 'YYYY-MM') as year_month,
    service,
    service_type,
    SUM(amount),
    SUM(api_calls),
    SUM(COALESCE(tokens_input, 0)),
    SUM(COALESCE(tokens_output, 0)),
    COUNT(DISTINCT user_id),
    NOW()
  FROM cost_tracking
  WHERE to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
  GROUP BY to_char(created_at, 'YYYY-MM'), service, service_type
  ON CONFLICT (year_month, service, service_type) 
  DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    total_api_calls = EXCLUDED.total_api_calls,
    total_tokens_input = EXCLUDED.total_tokens_input,
    total_tokens_output = EXCLUDED.total_tokens_output,
    unique_users = EXCLUDED.unique_users,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_monthly_cost_summary IS 'Updates monthly cost aggregations';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ FlowPost database schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - connections';
  RAISE NOTICE '  - workflows';
  RAISE NOTICE '  - posts';
  RAISE NOTICE '  - plans';
  RAISE NOTICE '  - user_subscriptions';
  RAISE NOTICE '  - user_credits';
  RAISE NOTICE '  - credit_transactions';
  RAISE NOTICE '  - credit_packages';
  RAISE NOTICE '  - cost_tracking';
  RAISE NOTICE '  - monthly_cost_summary';
END $$;
