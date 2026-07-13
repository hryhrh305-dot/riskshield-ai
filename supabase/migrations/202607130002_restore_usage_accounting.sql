-- Restore the server-side accounting tables already required by cost-control.ts.
-- Apply through the controlled Supabase migration process; do not run from a browser client.

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  api_key text,
  endpoint text not null,
  cost_units integer not null check (cost_units > 0),
  request_cost numeric(12, 6) not null default 0 check (request_cost >= 0),
  ip_address text,
  plan text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_user_created_idx
  on public.usage_ledger (user_id, created_at desc);
create index if not exists usage_ledger_api_key_created_idx
  on public.usage_ledger (api_key_id, created_at desc);
create index if not exists usage_ledger_ip_created_idx
  on public.usage_ledger (ip_address, created_at desc);

alter table public.usage_ledger enable row level security;
revoke all on public.usage_ledger from anon, authenticated;
grant all on public.usage_ledger to service_role;

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  ip_address text,
  event_type text not null,
  metric_value numeric,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists abuse_events_user_created_idx
  on public.abuse_events (user_id, created_at desc);
create index if not exists abuse_events_ip_created_idx
  on public.abuse_events (ip_address, created_at desc);

alter table public.abuse_events enable row level security;
revoke all on public.abuse_events from anon, authenticated;
grant all on public.abuse_events to service_role;
