-- ============================================================================
-- Analytics Cache Table for FlowPost
-- ============================================================================
-- This migration adds a table to cache user analytics data in PostgreSQL
-- instead of relying on client-side localStorage
--
-- Usage:
--   psql $DATABASE_URI -f migrations/002_analytics_cache.sql
-- ============================================================================

-- ============================================================================
-- USER_ANALYTICS_CACHE TABLE
-- Stores cached analytics data per user to avoid repeated fetches
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  -- Cached data stored as JSONB for flexibility
  posts_data JSONB DEFAULT '[]'::jsonb,
  connections_data JSONB DEFAULT '[]'::jsonb,
  -- Tracking
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_analytics_cache IS 'Caches analytics data per user to reduce API calls';
COMMENT ON COLUMN user_analytics_cache.posts_data IS 'Cached posts data as JSON array';
COMMENT ON COLUMN user_analytics_cache.connections_data IS 'Cached connections data as JSON array';
COMMENT ON COLUMN user_analytics_cache.last_updated_at IS 'When the cache was last refreshed';

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_analytics_cache_user_id ON user_analytics_cache(user_id);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Analytics cache table created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Table created:';
  RAISE NOTICE '  - user_analytics_cache';
END $$;

