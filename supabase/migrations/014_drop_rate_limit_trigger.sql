-- Remove per-INSERT cleanup trigger on api_rate_limit_log.
-- At high request volume (500+ clients) this trigger caused write amplification:
-- every INSERT ran a DELETE, creating O(n) load per request.
-- Replaced by Inngest cron cleanupRateLimitLogs (every 5 min).

DROP TRIGGER IF EXISTS trg_cleanup_rate_limit ON api_rate_limit_log;
DROP FUNCTION IF EXISTS cleanup_rate_limit_log();
