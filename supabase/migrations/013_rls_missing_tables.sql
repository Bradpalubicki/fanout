-- Migration 013: Enable RLS on 5 tables that were missing it
-- These are all system/admin tables — restrict to service_role only

-- oauth_state: CSRF protection tokens (system-managed)
ALTER TABLE oauth_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON oauth_state
  FOR ALL USING (auth.role() = 'service_role');

-- api_rate_limit_log: rate limiting records (system-managed)
ALTER TABLE api_rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON api_rate_limit_log
  FOR ALL USING (auth.role() = 'service_role');

-- oauth_app_credentials: OAuth app secrets (admin-only)
ALTER TABLE oauth_app_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON oauth_app_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- developer_accounts: TOTP secrets for platform dev accounts (admin-only)
ALTER TABLE developer_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON developer_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- two_factor_codes: 2FA verification codes (admin-only)
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON two_factor_codes
  FOR ALL USING (auth.role() = 'service_role');
