-- Secwyn version-controlled core schema baseline.
--
-- Historical deployments created these objects from the repository-root
-- supabase-schema.sql and narrowly scoped SQL Editor scripts.  Later migrations
-- therefore referenced them without creating them.  This compatibility
-- baseline makes a fresh migration replay self-contained while remaining
-- additive for an existing Secwyn database.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  plan text not null default 'free'
    check (plan in ('free','starter','growth','scale','business')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive','active','cancelled','expired','past_due','paused')),
  subscription_start timestamptz,
  subscription_end timestamptz,
  creem_customer_id text,
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  total_checks integer not null default 0 check (total_checks >= 0),
  risk_settings jsonb,
  webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists creem_customer_id text,
  add column if not exists credits_remaining integer not null default 0,
  add column if not exists total_checks integer not null default 0,
  add column if not exists risk_settings jsonb,
  add column if not exists webhook_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null unique,
  name text not null default 'Default',
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_user_created_idx
  on public.api_keys(user_id, created_at desc);
create index if not exists api_keys_active_user_idx
  on public.api_keys(user_id)
  where status = 'active';

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null,
  request_count integer not null default 0 check (request_count >= 0),
  date date not null default current_date,
  unique (user_id, api_key_id, endpoint, date)
);

create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_type text not null check (check_type in ('email','ip','risk')),
  input_value text not null,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  result_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists checks_user_created_idx
  on public.checks(user_id, created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_provider text not null,
  provider_subscription_id text,
  provider_customer_id text,
  provider_product_id text,
  plan text not null default 'free',
  status text not null default 'active'
    check (status in ('active','cancelled','expired','past_due','paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  billing_interval text check (billing_interval in ('monthly','yearly')),
  credit_anchor_at timestamptz,
  paid_through timestamptz,
  billing_terminal_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists provider_customer_id text,
  add column if not exists provider_product_id text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_checkout_id text,
  provider_transaction_id text,
  provider_subscription_id text,
  provider_customer_id text,
  provider_product_id text,
  amount numeric(12,2),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending','completed','failed','refunded')),
  plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists provider_subscription_id text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_product_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists subscriptions_user_created_idx
  on public.subscriptions(user_id, created_at desc);
create index if not exists payments_user_created_idx
  on public.payments(user_id, created_at desc);
create index if not exists payments_provider_checkout_idx
  on public.payments(provider, provider_checkout_id)
  where provider_checkout_id is not null;
create index if not exists payments_provider_subscription_idx
  on public.payments(provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- These two tables are backed by version-controlled historical schema and are
-- required by current authenticated product routes.  They are included here so
-- a fresh Secwyn database does not depend on a Dashboard SQL Editor step.
create table if not exists public.pre_send_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_name text not null default '',
  total_contacts integer not null default 0 check (total_contacts >= 0),
  allowed_count integer not null default 0 check (allowed_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  risk_score_avg integer not null default 0 check (risk_score_avg between 0 and 100),
  status text not null default 'completed' check (status in ('completed','processing','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.pre_send_results (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.pre_send_checks(id) on delete cascade,
  email text not null,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  decision text not null default 'ALLOW' check (decision in ('ALLOW','REVIEW','BLOCK')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pre_send_checks_user_created_idx
  on public.pre_send_checks(user_id, created_at desc);
create index if not exists pre_send_results_check_idx
  on public.pre_send_results(check_id);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewed','closed')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_user_created_idx
  on public.feedback_messages(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.checks enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.pre_send_checks enable row level security;
alter table public.pre_send_results enable row level security;
alter table public.feedback_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users read own profile') then
    create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users update own profile') then
    create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_keys' and policyname='Users read own keys') then
    create policy "Users read own keys" on public.api_keys for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_keys' and policyname='Users insert own keys') then
    create policy "Users insert own keys" on public.api_keys for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_keys' and policyname='Users update own keys') then
    create policy "Users update own keys" on public.api_keys for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_usage' and policyname='Users read own usage') then
    create policy "Users read own usage" on public.api_usage for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='checks' and policyname='Users read own checks') then
    create policy "Users read own checks" on public.checks for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='subscriptions' and policyname='Users read own subscriptions') then
    create policy "Users read own subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='Users read own payments') then
    create policy "Users read own payments" on public.payments for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_send_checks' and policyname='Users read own pre_send') then
    create policy "Users read own pre_send" on public.pre_send_checks for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_send_results' and policyname='Users read own pre_send_results') then
    create policy "Users read own pre_send_results" on public.pre_send_results for select to authenticated using (
      exists (select 1 from public.pre_send_checks c where c.id=check_id and c.user_id=(select auth.uid()))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback_messages' and policyname='Users insert own feedback messages') then
    create policy "Users insert own feedback messages" on public.feedback_messages for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback_messages' and policyname='Users read own feedback messages') then
    create policy "Users read own feedback messages" on public.feedback_messages for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;

revoke all on table public.profiles,public.api_keys,public.api_usage,public.checks,
  public.subscriptions,public.payments,public.pre_send_checks,public.pre_send_results,
  public.feedback_messages from anon;
grant select,insert,update,delete on table public.profiles,public.api_keys,public.api_usage,
  public.checks,public.subscriptions,public.payments,public.pre_send_checks,
  public.pre_send_results,public.feedback_messages to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id,email,name,plan)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.increment_api_usage(
  p_user_id uuid,p_api_key_id uuid,p_endpoint text,p_date date
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.api_usage(user_id,api_key_id,endpoint,request_count,date)
  values(p_user_id,p_api_key_id,p_endpoint,1,p_date)
  on conflict (user_id,api_key_id,endpoint,date)
  do update set request_count=public.api_usage.request_count+1;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.increment_api_usage(uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function public.increment_api_usage(uuid,uuid,text,date) to service_role;
