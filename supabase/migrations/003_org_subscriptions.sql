create table if not exists org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id text not null unique,
  plan_key text not null default 'trial',
  status text not null default 'trialing', -- trialing | active | expired | canceled
  trial_started_at timestamptz not null default now(),
  trial_expires_at timestamptz not null default (now() + interval '14 days'),
  activated_at timestamptz,
  expires_at timestamptz,
  square_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_subscriptions_org_id_idx on org_subscriptions(org_id);

alter table org_subscriptions enable row level security;

-- updated_at trigger
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists org_subscriptions_updated_at on org_subscriptions;
create trigger org_subscriptions_updated_at
  before update on org_subscriptions
  for each row execute procedure update_updated_at_column();

-- Add default_timezone column (migration 004)
alter table org_subscriptions add column if not exists default_timezone text not null default 'UTC';
