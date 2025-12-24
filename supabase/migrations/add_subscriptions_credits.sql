-- ============================================================================
-- SUBSCRIPTIONS & CREDITS SYSTEM
-- FlowPost SaaS billing and usage tracking
-- ============================================================================

-- ============================================================================
-- PLANS TABLE
-- Define subscription tiers and their limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================================
-- USER_CREDITS TABLE
-- Track user credit balance and usage
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================================
-- CREDIT_TRANSACTIONS TABLE
-- Audit trail for all credit changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  -- Transaction details
  amount INTEGER NOT NULL, -- positive for additions, negative for deductions
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'subscription_credit', -- Monthly credit allocation
    'usage',              -- Workflow execution
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

-- ============================================================================
-- CREDIT_PACKAGES TABLE
-- One-time credit purchase options
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Plans are public (read-only for all)
CREATE POLICY "Plans are viewable by everyone" ON plans
  FOR SELECT USING (true);

-- Credit packages are public (read-only for all)
CREATE POLICY "Credit packages are viewable by everyone" ON credit_packages
  FOR SELECT USING (true);

-- Users can only see their own subscription
DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
CREATE POLICY "Users can view their own subscription" ON user_subscriptions
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

-- Users can only see their own credits
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
CREATE POLICY "Users can view their own credits" ON user_credits
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

-- Users can only see their own transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
CREATE POLICY "Users can view their own transactions" ON credit_transactions
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to initialize credits for new user
CREATE OR REPLACE FUNCTION initialize_user_credits(p_user_id TEXT, p_plan_slug TEXT DEFAULT 'free')
RETURNS void AS $$
DECLARE
  v_plan_id UUID;
  v_credits INTEGER;
BEGIN
  -- Get plan details
  SELECT id, credits_per_month INTO v_plan_id, v_credits
  FROM plans WHERE slug = p_plan_slug;

  -- Create subscription record
  INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  VALUES (p_user_id, v_plan_id, 'active', NOW(), NOW() + INTERVAL '1 month')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create credits record
  INSERT INTO user_credits (user_id, credits_balance, last_reset_at, next_reset_at)
  VALUES (p_user_id, v_credits, NOW(), NOW() + INTERVAL '1 month')
  ON CONFLICT (user_id) DO NOTHING;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
  VALUES (p_user_id, v_credits, v_credits, 'subscription_credit', 'Initial free tier credits');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id TEXT, 
  p_amount INTEGER, 
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance (including bonus credits)
  SELECT credits_balance + bonus_credits INTO v_current_balance
  FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

  -- Check if sufficient credits
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct from bonus credits first, then regular balance
  v_new_balance := v_current_balance - p_amount;

  -- Update credits
  UPDATE user_credits 
  SET 
    credits_balance = GREATEST(0, credits_balance - GREATEST(0, p_amount - bonus_credits)),
    bonus_credits = GREATEST(0, bonus_credits - p_amount),
    credits_used_this_month = credits_used_this_month + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, reference_type, reference_id, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'usage', p_reference_type, p_reference_id, p_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_is_bonus BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_is_bonus THEN
    UPDATE user_credits 
    SET bonus_credits = bonus_credits + p_amount, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits_balance + bonus_credits INTO v_new_balance;
  ELSE
    UPDATE user_credits 
    SET credits_balance = credits_balance + p_amount, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING credits_balance + bonus_credits INTO v_new_balance;
  END IF;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
  VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE user_credits uc
  SET 
    credits_balance = p.credits_per_month,
    credits_used_this_month = 0,
    last_reset_at = NOW(),
    next_reset_at = NOW() + INTERVAL '1 month',
    updated_at = NOW()
  FROM user_subscriptions us
  JOIN plans p ON us.plan_id = p.id
  WHERE uc.user_id = us.user_id
    AND us.status = 'active'
    AND uc.next_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE plans IS 'Subscription plan definitions with pricing and limits';
COMMENT ON TABLE user_subscriptions IS 'User subscription status and Stripe integration';
COMMENT ON TABLE user_credits IS 'User credit balance and usage tracking';
COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit changes';
COMMENT ON TABLE credit_packages IS 'One-time credit purchase options';

