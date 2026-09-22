-- post_results had only PRIMARY KEY (id), so every `upsert` on (post_id, platform)
-- INSERTED a new row instead of updating. Failures and retries therefore accumulated
-- duplicate rows per platform, and the `attempts` counter could never increment reliably.
-- Collapse existing duplicates (keep the newest per post/platform), then enforce uniqueness.

DELETE FROM post_results a
USING post_results b
WHERE a.post_id = b.post_id
  AND a.platform = b.platform
  AND a.ctid < b.ctid;

ALTER TABLE post_results
  ADD CONSTRAINT post_results_post_platform_key UNIQUE (post_id, platform);
