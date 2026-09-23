-- Defense in depth: stop relying on RLS alone to protect sensitive tables.
--
-- MEASURED STATE BEFORE THIS MIGRATION (project jifhgpwiqgwkgqtmozsu, 2026-09-22):
--   * The `anon` role held SELECT/INSERT/UPDATE/DELETE on every table in public,
--     including oauth_tokens, oauth_app_credentials, two_factor_codes and
--     org_subscriptions.
--   * RLS was enabled on all 27 tables and DID correctly deny anon — probed by
--     `SET LOCAL ROLE anon`, which returned 0 rows from profiles (a table holding
--     2 real rows), organizations, org_subscriptions and oauth_tokens.
--   * organizations and org_subscriptions had RLS enabled with ZERO policies.
--
-- So nothing is currently exposed. The problem is that RLS is the ONLY layer:
-- the anon key ships in the browser bundle, and a single disabled RLS flag, a
-- mistyped policy, or one `USING (true)` turns encrypted credentials and
-- subscription records into world-readable — or world-writable — data.
--
-- The application never uses the anon key: `supabaseAnon` is exported from
-- src/lib/supabase.ts and has zero consumers. Every query runs through the
-- service-role client, which bypasses both RLS and these grants. Revoking the
-- anon grants is therefore a no-op for the app and removes the single point of
-- failure.
--
-- short_links is deliberately EXCLUDED: it carries an intentional
-- `anon_select_short_links USING (true)` policy for public link redirects.

-- ─── 1. Revoke blanket anon write access across the schema ───────────────────
-- Anon must never write anywhere. This is unconditional.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- ─── 2. Revoke anon SELECT on credential- and billing-bearing tables ─────────
-- Explicitly enumerated rather than blanket-revoked, so that adding a future
-- table with intended public reads (like short_links) is a deliberate act and
-- not silently broken by this migration.
REVOKE SELECT ON
  oauth_tokens,
  oauth_app_credentials,
  oauth_state,
  oauth_audit_log,
  developer_accounts,
  two_factor_codes,
  org_subscriptions,
  organizations,
  webhook_logs,
  api_rate_limit_log,
  account_creation_log,
  product_platform_accounts,
  setup_jobs,
  onboarding_sessions
FROM anon;

-- ─── 3. Do not hand these grants to newly created tables ─────────────────────
-- Without this, the next `CREATE TABLE` re-grants anon everything by default
-- and quietly reopens the hole this migration closes.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- ─── 4. Explicit deny-by-default policies on the two bare tables ─────────────
-- organizations and org_subscriptions had RLS on with no policies at all.
-- "No policy" already means "deny", but it is indistinguishable from "somebody
-- forgot to write one" — which invites a future author to add a permissive
-- policy rather than a scoped one. These make the intent explicit and match the
-- service_role pattern already used on 17 other policies in this schema.
CREATE POLICY "service_role_organizations" ON organizations
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_org_subscriptions" ON org_subscriptions
  USING (auth.role() = 'service_role');
