alter table posts
  add column if not exists review_note text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

-- status column is already TEXT with a CHECK constraint that includes 'pending_approval'
-- No enum change needed

create index if not exists idx_posts_created_by on posts(created_by);
create index if not exists idx_posts_status_created_by on posts(status, created_by);
