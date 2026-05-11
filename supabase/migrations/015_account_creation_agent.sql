-- Account Creation Agent support tables
-- Adds is_active to oauth_tokens (Fix-5 coordination) + account_creation_log

-- Add is_active to oauth_tokens if not already present (Fix-5 coordination)
ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add platform_handle to oauth_tokens for Bluesky handle storage
ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS platform_handle TEXT;

-- Account creation audit log
CREATE TABLE IF NOT EXISTS account_creation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  platform    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('success', 'failed', 'orphaned')),
  handle      TEXT,
  platform_did TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: service role write only, no org-level read
ALTER TABLE account_creation_log ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for org users — internal/operator only
CREATE POLICY "service_role_only" ON account_creation_log
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_account_creation_log_org
  ON account_creation_log (org_id, platform, created_at DESC);
