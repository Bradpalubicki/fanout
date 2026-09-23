-- 019 — N6: account-level analytics.
--
-- WHY A NEW TABLE:
-- analytics_snapshots is keyed on post_result_id, so it can only ever describe
-- ONE POST. Follower count, account reach and audience are properties of the
-- ACCOUNT, not of any post, and there is no post to hang them on. Reusing that
-- table would force a fake post_result row per account per day.
--
-- This is the gap CX correctly identified as new construction rather than
-- exposure: what exists counts local publishing outcomes (did Fanout's own post
-- succeed) plus per-post metrics. Neither answers "is this client growing?",
-- which is the question an agency reports to its client every month.

CREATE TABLE IF NOT EXISTS account_analytics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scoped to a PROFILE, never an org. An API key identifies one profile, and
  -- /api/v1 must not let profile A read sibling B — the authorization failure
  -- CX reproduced on 2026-09-23.
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,

  -- CUMULATIVE account totals as reported by the provider at collection time.
  -- Never summed across rows: two snapshots of 400 and 410 followers mean the
  -- account has 410, not 810. That double-count shipped once already in
  -- mobile/analytics and was fixed on 2026-09-23.
  followers      INT,
  following      INT,
  posts_count    INT,

  -- Period metrics, where the provider exposes them. These DO describe a window
  -- rather than a running total, so they are not comparable to the cumulative
  -- columns above and must not be mixed with them.
  impressions    INT,
  reach          INT,
  profile_views  INT,
  engagements    INT,

  -- Whatever else a platform returns that has no column. Keeps provider-specific
  -- fields without a migration per platform.
  raw            JSONB,

  -- The DAY this describes, provider-reported where available. Deliberately a
  -- DATE, not a timestamp: it is the grain the unique constraint needs, and it
  -- makes "one row per account per day" expressible.
  collected_for  DATE NOT NULL DEFAULT CURRENT_DATE,
  collected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A real UNIQUE CONSTRAINT (contype='u'), not an index that merely looks like
  -- one: the collector's ON CONFLICT depends on it. Re-running collection on the
  -- same day UPDATES rather than inserting a duplicate day.
  CONSTRAINT account_analytics_day UNIQUE (profile_id, platform, collected_for)
);

-- Growth is read as a time series for one profile, usually per platform.
CREATE INDEX IF NOT EXISTS idx_account_analytics_profile_day
  ON account_analytics (profile_id, collected_for DESC);
CREATE INDEX IF NOT EXISTS idx_account_analytics_profile_platform_day
  ON account_analytics (profile_id, platform, collected_for DESC);

-- Defence in depth, matching 017 and 018. RLS alone is not the barrier because
-- service_role bypasses it; the GRANT layer is what stops an anon caller.
REVOKE ALL ON account_analytics FROM anon;
ALTER TABLE account_analytics ENABLE ROW LEVEL SECURITY;
