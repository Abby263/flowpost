-- ============================================================================
-- COST TRACKING TABLE
-- Track all external service costs (AI APIs, infrastructure, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Service identification
  service TEXT NOT NULL, -- 'openai', 'anthropic', 'gemini', 'firecrawl', 'infrastructure', etc.
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

-- ============================================================================
-- MONTHLY COST SUMMARY TABLE
-- Aggregated monthly costs for quick reporting
-- ============================================================================

CREATE TABLE IF NOT EXISTS monthly_cost_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cost_tracking_service ON cost_tracking(service);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service_type ON cost_tracking(service_type);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_summary_year_month ON monthly_cost_summary(year_month DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Cost tracking is admin-only, no public access
-- ============================================================================

ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cost_summary ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for admin API)
-- No public policies - only accessible via service role key

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to log a cost entry
CREATE OR REPLACE FUNCTION log_cost(
  p_service TEXT,
  p_service_type TEXT,
  p_amount DECIMAL,
  p_user_id TEXT DEFAULT NULL,
  p_workflow_id UUID DEFAULT NULL,
  p_tokens_input INTEGER DEFAULT NULL,
  p_tokens_output INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_cost_id UUID;
BEGIN
  INSERT INTO cost_tracking (
    service, service_type, amount, user_id, workflow_id,
    tokens_input, tokens_output, description, metadata
  ) VALUES (
    p_service, p_service_type, p_amount, p_user_id, p_workflow_id,
    p_tokens_input, p_tokens_output, p_description, p_metadata
  ) RETURNING id INTO v_cost_id;

  RETURN v_cost_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cost summary for a period
CREATE OR REPLACE FUNCTION get_cost_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  service TEXT,
  service_type TEXT,
  total_amount DECIMAL,
  total_calls INTEGER,
  avg_cost_per_call DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.service,
    ct.service_type,
    SUM(ct.amount)::DECIMAL as total_amount,
    COUNT(*)::INTEGER as total_calls,
    (SUM(ct.amount) / COUNT(*))::DECIMAL as avg_cost_per_call
  FROM cost_tracking ct
  WHERE ct.created_at >= p_start_date AND ct.created_at <= p_end_date
  GROUP BY ct.service, ct.service_type
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update monthly summary (run via cron)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (Optional - Remove in production)
-- ============================================================================

-- Insert some sample cost data for demonstration
-- INSERT INTO cost_tracking (service, service_type, amount, tokens_input, tokens_output, description) VALUES
--   ('openai', 'ai_model', 0.0015, 500, 200, 'GPT-4 post generation'),
--   ('openai', 'ai_model', 0.0008, 300, 100, 'GPT-4 content analysis'),
--   ('anthropic', 'ai_model', 0.0012, 400, 150, 'Claude post refinement'),
--   ('gemini', 'ai_model', 0.0005, 600, 250, 'Gemini content ideas'),
--   ('firecrawl', 'web_scraping', 0.002, NULL, NULL, 'Web page scraping'),
--   ('flux', 'image_generation', 0.04, NULL, NULL, 'Image generation for post');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cost_tracking IS 'Detailed log of all external service costs';
COMMENT ON TABLE monthly_cost_summary IS 'Aggregated monthly cost data for reporting';
COMMENT ON COLUMN cost_tracking.service IS 'External service name (openai, anthropic, firecrawl, etc.)';
COMMENT ON COLUMN cost_tracking.service_type IS 'Category of service (ai_model, image_generation, etc.)';
COMMENT ON COLUMN cost_tracking.amount IS 'Cost in USD';

