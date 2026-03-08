create table if not exists mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  org_id text not null,
  token text not null,
  platform text not null default 'expo',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, token)
);

create index if not exists idx_mobile_push_tokens_user on mobile_push_tokens(user_id);
create index if not exists idx_mobile_push_tokens_org on mobile_push_tokens(org_id);
