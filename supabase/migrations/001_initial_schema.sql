-- Enable pgcrypto for token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper functions for token encryption
CREATE OR REPLACE FUNCTION encrypt_token(raw_token TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(raw_token, encryption_key)::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64')::bytea, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles (one per client/org)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  api_key_hash TEXT,
  webhook_url  TEXT,
  timezone     TEXT DEFAULT 'UTC',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth tokens (encrypted access/refresh tokens per platform)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_secret      TEXT,
  expires_at        TIMESTAMPTZ,
  scopes            TEXT[],
  platform_user_id  TEXT,
  platform_username TEXT,
  platform_page_id  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, platform)
);

-- OAuth state tokens (CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_state (
  token      TEXT PRIMARY KEY,
  profile_id UUID NOT NULL,
  platform   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated drafts pending approval
CREATE TABLE IF NOT EXISTS ai_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt      TEXT NOT NULL,
  generated   TEXT NOT NULL,
  platforms   TEXT[],
  status      TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'posted')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  platforms     TEXT[] NOT NULL,
  media_urls    TEXT[],
  scheduled_for TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posting', 'posted', 'failed', 'draft', 'pending_approval')),
  source        TEXT DEFAULT 'api' CHECK (source IN ('api', 'dashboard', 'ai_generated')),
  ai_draft_id   UUID REFERENCES ai_drafts(id),
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Post results per platform
CREATE TABLE IF NOT EXISTS post_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  platform_post_id  TEXT,
  platform_post_url TEXT,
  error_message     TEXT,
  attempts          INT DEFAULT 0,
  posted_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics snapshots
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_result_id UUID NOT NULL REFERENCES post_results(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,
  impressions    INT,
  likes          INT,
  comments       INT,
  shares         INT,
  clicks         INT,
  reach          INT,
  collected_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for all OAuth actions
CREATE TABLE IF NOT EXISTS oauth_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL,
  platform   TEXT NOT NULL,
  action     TEXT NOT NULL,
  success    BOOLEAN,
  ip_address INET,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_profile ON oauth_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_posts_profile ON posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_post_results_post ON post_results(post_id);
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON oauth_state(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_profile ON oauth_audit_log(profile_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: org members see their own profile
CREATE POLICY "org_profiles" ON profiles
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id'));

-- Tokens: via profile org check
CREATE POLICY "org_tokens" ON oauth_tokens
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- Posts
CREATE POLICY "org_posts" ON posts
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- Post results
CREATE POLICY "org_post_results" ON post_results
  FOR ALL USING (
    post_id IN (
      SELECT p.id FROM posts p
      JOIN profiles pr ON p.profile_id = pr.id
      WHERE pr.org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- AI drafts
CREATE POLICY "org_ai_drafts" ON ai_drafts
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM profiles WHERE org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- Analytics
CREATE POLICY "org_analytics" ON analytics_snapshots
  FOR ALL USING (
    post_result_id IN (
      SELECT pr.id FROM post_results pr
      JOIN posts p ON pr.post_id = p.id
      JOIN profiles prof ON p.profile_id = prof.id
      WHERE prof.org_id = (auth.jwt() ->> 'org_id')
    )
  );
