-- API rate limit log for sliding window limiting on /api/v1/* routes
CREATE TABLE IF NOT EXISTS api_rate_limit_log (
  id         BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_profile_time
  ON api_rate_limit_log(profile_id, created_at DESC);

-- Auto-clean entries older than 2 minutes (keeps table lean)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log() RETURNS trigger AS $$
BEGIN
  DELETE FROM api_rate_limit_log WHERE created_at < NOW() - INTERVAL '2 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_rate_limit ON api_rate_limit_log;
CREATE TRIGGER trg_cleanup_rate_limit
  AFTER INSERT ON api_rate_limit_log
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_rate_limit_log();
