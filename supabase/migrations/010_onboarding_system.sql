-- Fanout Onboarding System
-- Magic link sessions + onboarding state on profiles

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  org_id         TEXT,
  prefill_json   JSONB,
  sign_in_token  TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used           BOOLEAN DEFAULT FALSE,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user ON onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_expires ON onboarding_sessions(expires_at);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete        BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at    TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_type                TEXT DEFAULT 'direct';
