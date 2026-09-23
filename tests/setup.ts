// Env the modules under test read at import time. Values are deliberately fake:
// these tests must never reach a real platform, Clerk, or Supabase.
process.env.TWILIO_AUTH_TOKEN ??= 'test_twilio_auth_token'
process.env.TWILIO_WEBHOOK_URL ??= 'https://fanout.digital/api/webhooks/inbound-sms'
process.env.FANOUT_ADMIN_KEY ??= 'test_admin_key'
process.env.INTERNAL_API_KEY ??= 'test_internal_key'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test_service_role_key'
process.env.ENCRYPTION_KEY ??= '0'.repeat(64)
