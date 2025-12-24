-- FlowPost Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database
-- https://supabase.com/dashboard > SQL Editor > New Query

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CONNECTIONS TABLE
-- Stores social media platform credentials
-- ============================================================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'slack')),
  profile_name TEXT,
  credentials JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOWS TABLE
-- Stores automated workflow configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Add comments for run tracking fields
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

-- Add comments for documentation
COMMENT ON COLUMN posts.status IS 'Values: draft, scheduled, published, failed, pending';
COMMENT ON COLUMN posts.source IS 'Values: workflow, manual, trending, ai-generated';

-- ============================================================================
-- INDEXES
-- For faster query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_run_status ON workflows(run_status) WHERE run_status = 'running';
CREATE INDEX IF NOT EXISTS idx_posts_workflow_id ON posts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Designed for Clerk: set Supabase JWT "sub" to the Clerk user ID.
-- ============================================================================

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only active when RLS is enabled)
DROP POLICY IF EXISTS "Users can view their own connections" ON connections;
DROP POLICY IF EXISTS "Users can insert their own connections" ON connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON connections;

DROP POLICY IF EXISTS "Users can view their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can insert their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can update their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can delete their own workflows" ON workflows;

DROP POLICY IF EXISTS "Users can view their own posts" ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- Connection policies
CREATE POLICY "Users can view their own connections" ON connections
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert their own connections" ON connections
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can update their own connections" ON connections
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can delete their own connections" ON connections
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');

-- Workflow policies
CREATE POLICY "Users can view their own workflows" ON workflows
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert their own workflows" ON workflows
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can update their own workflows" ON workflows
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can delete their own workflows" ON workflows
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');

-- Post policies
CREATE POLICY "Users can view their own posts" ON posts
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
