-- src/inngest/functions/retry-failed.ts:38 has always called
--   supabase.rpc('increment_post_attempts', { post_ids: [...] })
-- but the function was never defined in any migration, and confirmed absent from
-- production (pg_proc lookup returned 0 rows). The call sits inside a step.run
-- whose error is not checked, so it failed silently on every retry cycle.
--
-- Consequence: post_results.attempts stayed 0 forever, so the retry query's
-- `.lt('attempts', 3)` cap never engaged. A permanently failing post was
-- re-sent every 30 minutes indefinitely instead of stopping after 3 tries.
--
-- The caller passes POST ids (not post_results ids), so every failed result row
-- belonging to those posts is incremented. Only 'failed' rows are touched: a
-- succeeded platform in a partially-failed post must not accrue attempts.

CREATE OR REPLACE FUNCTION increment_post_attempts(post_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE post_results
     SET attempts = COALESCE(attempts, 0) + 1
   WHERE post_id = ANY(post_ids)
     AND status = 'failed';
$$;

REVOKE ALL ON FUNCTION increment_post_attempts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_post_attempts(uuid[]) TO service_role;
