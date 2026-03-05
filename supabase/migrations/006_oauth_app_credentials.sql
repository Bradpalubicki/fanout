-- OAuth app credentials registered on each platform's developer portal
CREATE TABLE IF NOT EXISTS oauth_app_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE,
  client_id text,
  client_secret text,
  app_name text,
  status text DEFAULT 'pending', -- pending | active | review_required | error
  registered_at timestamptz,
  last_verified timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Developer accounts used for each platform's dev portal
CREATE TABLE IF NOT EXISTS developer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE,
  email text NOT NULL,
  totp_secret text,           -- base32 TOTP secret for authenticator-based 2FA
  twilio_phone text,          -- Twilio number for SMS 2FA
  session_valid_until timestamptz,
  session_path text,          -- local path to saved Playwright session
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Intercepted 2FA codes (email + SMS) for automated login
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  channel text NOT NULL,      -- 'email' | 'sms' | 'totp'
  code text NOT NULL,
  raw_message text,
  received_at timestamptz DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_2fa_codes_platform_received
  ON two_factor_codes(platform, received_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_app_credentials_updated_at
  BEFORE UPDATE ON oauth_app_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER developer_accounts_updated_at
  BEFORE UPDATE ON developer_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
