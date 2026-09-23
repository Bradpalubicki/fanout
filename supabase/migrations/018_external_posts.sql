-- 018 — Native history: posts the account created OUTSIDE Fanout.
--
-- WHY A SEPARATE TABLE, not a nullable post_results.post_id:
-- post_results carries DELIVERY semantics — attempts, error_message,
-- status('success'|'failed'), posted_at. Every one of those is meaningless for
-- a post we merely observed on a provider. Reusing that table would make every
-- future query ambiguous about whether a row is something we SENT or something
-- we SAW, and "did we publish this?" is exactly the question the whole product
-- answers. Keeping them separate keeps that answer unambiguous.
--
-- Scope: written by the backfill/sync job, read by /api/v1/history.
-- Native history is available only where the granted scopes permit reading an
-- account's own posts — see nativeHistory in src/lib/oauth-config.ts.

CREATE TABLE IF NOT EXISTS external_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scoped to a PROFILE, not an org. An API key identifies exactly one profile,
  -- and /api/v1/history must never let profile A read sibling profile B's rows.
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  platform          TEXT NOT NULL,

  -- The provider's own id for the post. Together with profile+platform this is
  -- the natural key: re-running a backfill must UPDATE, never duplicate.
  platform_post_id  TEXT NOT NULL,

  platform_post_url TEXT,
  content           TEXT,
  media_urls        TEXT[],

  -- When the POST was published on the platform (provider-reported), not when
  -- we discovered it. Ordering history by discovery time would scramble a
  -- backfill, which imports old posts "now".
  published_at      TIMESTAMPTZ,

  -- Distinguishes a post Fanout sent (later reconciled) from one found only on
  -- the provider. 'fanout' rows let history stay complete without claiming we
  -- observed something we actually published.
  origin            TEXT NOT NULL DEFAULT 'native'
                    CHECK (origin IN ('native', 'fanout')),

  -- Cumulative provider metrics at last sync. Deliberately NOT summed across
  -- syncs: these are running totals, and summing them double-counts (the exact
  -- defect fixed in mobile/analytics on 2026-09-23).
  metrics           JSONB,

  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A real UNIQUE CONSTRAINT (contype='u'), not an index that merely looks like
  -- one: ON CONFLICT below depends on it, and an index would not enforce it.
  CONSTRAINT external_posts_natural_key UNIQUE (profile_id, platform, platform_post_id)
);

-- History is read newest-first for one profile, usually filtered by platform.
CREATE INDEX IF NOT EXISTS idx_external_posts_profile_published
  ON external_posts (profile_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_posts_profile_platform
  ON external_posts (profile_id, platform, published_at DESC);

-- Resumable backfill state. A 200-500 post import WILL be interrupted; without
-- a durable cursor each retry restarts from the top and re-pages the provider,
-- burning rate limit that several platforms measure in tens of calls per hour.
CREATE TABLE IF NOT EXISTS external_post_sync_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,

  -- Opaque provider cursor. Pagination differs per platform (Graph 'after',
  -- Twitter pagination_token, TikTok cursor), so this is deliberately untyped.
  cursor            TEXT,

  -- NULL until the first full backfill completes. Until then incremental sync
  -- must not run, or it would leave a permanent hole in the middle of history.
  backfill_completed_at TIMESTAMPTZ,

  last_run_at       TIMESTAMPTZ,
  last_error        TEXT,
  posts_imported    INT NOT NULL DEFAULT 0,

  CONSTRAINT external_post_sync_state_key UNIQUE (profile_id, platform)
);

-- Defence in depth, matching migration 017: anon must not reach these tables.
-- RLS alone is not the barrier — service_role bypasses RLS, so the GRANT layer
-- is what actually stops an anon caller.
REVOKE ALL ON external_posts FROM anon;
REVOKE ALL ON external_post_sync_state FROM anon;

ALTER TABLE external_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_post_sync_state ENABLE ROW LEVEL SECURITY;
