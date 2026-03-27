-- Social Posts Queue
-- Used by the posting agent to schedule and track posts for NuStack products
-- Products: certusaudit, pocketpals, sitegrade, wellness-engine

CREATE TABLE IF NOT EXISTS social_posts_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product        TEXT NOT NULL,  -- 'certusaudit', 'pocketpals', 'sitegrade', 'wellness-engine'
  platform       TEXT NOT NULL,  -- 'twitter', 'linkedin', 'instagram', 'tiktok', 'bluesky', etc.
  content        TEXT NOT NULL,
  image_url      TEXT,
  scheduled_for  TIMESTAMPTZ,
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posting', 'posted', 'failed', 'skipped')),
  error_text     TEXT,
  posted_at      TIMESTAMPTZ,
  platform_post_id   TEXT,
  platform_post_url  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spq_status ON social_posts_queue(status);
CREATE INDEX IF NOT EXISTS idx_spq_scheduled ON social_posts_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spq_product ON social_posts_queue(product);
CREATE INDEX IF NOT EXISTS idx_spq_pending ON social_posts_queue(status, scheduled_for) WHERE status = 'pending';

-- Product platform accounts: maps product + platform to credentials
-- access_token and refresh_token are stored encrypted (same pgp_sym_encrypt as oauth_tokens)
CREATE TABLE IF NOT EXISTS product_platform_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product         TEXT NOT NULL,
  platform        TEXT NOT NULL,
  account_handle  TEXT,           -- @handle for logging/display
  access_token    TEXT NOT NULL,  -- encrypted
  refresh_token   TEXT,           -- encrypted
  token_secret    TEXT,           -- for OAuth 1.0 platforms
  expires_at      TIMESTAMPTZ,
  platform_user_id TEXT,
  extra_config    JSONB,          -- e.g. { "instance_url": "mastodon.social" }
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product, platform)
);

-- RLS: service role only (agent uses service role key)
ALTER TABLE social_posts_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_platform_accounts ENABLE ROW LEVEL SECURITY;

-- No org-level access — these are internal NuStack product accounts only
-- Access via service role key in cron agent only
CREATE POLICY "service_role_only_spq" ON social_posts_queue
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_ppa" ON product_platform_accounts
  USING (auth.role() = 'service_role');
