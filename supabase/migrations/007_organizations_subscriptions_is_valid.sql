-- Organizations table (Clerk org metadata mirror for reporting)
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     TEXT NOT NULL UNIQUE,
  name       TEXT,
  plan_key   TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Subscriptions view alias (agency routes query 'subscriptions' but data lives in org_subscriptions)
CREATE OR REPLACE VIEW subscriptions AS
  SELECT id, org_id, plan_key, status, created_at
  FROM org_subscriptions;

-- Add is_valid column to oauth_tokens (tracks whether token is still working)
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT TRUE;

-- Index for agency health queries
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_is_valid ON oauth_tokens(is_valid) WHERE is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at);
