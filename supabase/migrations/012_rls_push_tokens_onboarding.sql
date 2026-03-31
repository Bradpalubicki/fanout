-- Add RLS to mobile_push_tokens and onboarding_sessions
-- These tables were created without RLS enabled

-- mobile_push_tokens: users can only see/manage their own tokens
ALTER TABLE mobile_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_push_tokens" ON mobile_push_tokens
  USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_push_tokens" ON mobile_push_tokens
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_delete_own_push_tokens" ON mobile_push_tokens
  FOR DELETE USING (auth.uid()::text = user_id);

-- service role bypass for cron/push notification sender
CREATE POLICY "service_role_push_tokens" ON mobile_push_tokens
  USING (auth.role() = 'service_role');

-- onboarding_sessions: service role only (created server-side via API key auth)
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_onboarding_sessions" ON onboarding_sessions
  USING (auth.role() = 'service_role');
