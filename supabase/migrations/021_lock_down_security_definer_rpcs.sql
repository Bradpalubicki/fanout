-- Supabase's database linter flagged three SECURITY DEFINER functions as
-- callable over the public REST API.
--
-- Migration 020 tried to revoke increment_post_attempts from PUBLIC/anon, but
-- `authenticated=X` still stood: revoking PUBLIC does not remove a grant held
-- explicitly by a role, and Supabase grants `authenticated` by default. The
-- "service_role only" claim in 020 was therefore wrong -- verified against
-- pg_proc.proacl, not assumed.
--
-- decrypt_token/encrypt_token are the serious pair: SECURITY DEFINER and
-- granted to `anon`, so an UNAUTHENTICATED caller could reach them at
-- /rest/v1/rpc/decrypt_token. Both are only ever invoked server-side with the
-- service-role key, so no legitimate caller loses access.
--
-- Verified after applying. service_role=true is the discriminating half: a
-- lockout that broke legitimate access would also show false there and would
-- otherwise look like a pass.
--   decrypt_token           anon=f authenticated=f service_role=t
--   encrypt_token           anon=f authenticated=f service_role=t
--   increment_post_attempts anon=f authenticated=f service_role=t

REVOKE EXECUTE ON FUNCTION public.increment_post_attempts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_post_attempts(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrypt_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrypt_token(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.encrypt_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.encrypt_token(text, text) TO service_role;
