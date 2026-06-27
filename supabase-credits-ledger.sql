-- Task 2A migration draft
-- This file is a draft only.
-- Do not run automatically.
-- Review manually in the Supabase SQL editor before any production use.
-- This draft does not remove existing credits_remaining or consume_credit logic.

create extension if not exists pgcrypto;

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  credit_type text not null check (credit_type in ('contact_audit', 'client_report')),
  source_type text not null check (source_type in ('subscription', 'top_up', 'referral_bonus', 'small_report', 'manual_adjustment')),
  source_ref text null,
  granted_amount integer not null check (granted_amount >= 0),
  remaining_amount integer not null check (remaining_amount >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz null,
  billing_period_start timestamptz null,
  billing_period_end timestamptz null,
  status text not null default 'active' check (status in ('active', 'expired', 'consumed', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  credit_grant_id uuid not null references public.credit_grants(id) on delete restrict,
  credit_type text not null check (credit_type in ('contact_audit', 'client_report')),
  amount_used integer not null check (amount_used > 0),
  usage_reason text not null check (usage_reason in ('audit_contacts', 'export_client_report', 'api_audit', 'sheets_audit', 'small_report_audit', 'refund_reversal', 'manual_adjustment')),
  related_audit_id uuid null,
  related_report_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_grants_user_type_status_expiry
  on public.credit_grants (user_id, credit_type, status, expires_at);

create index if not exists idx_credit_grants_user_source_status
  on public.credit_grants (user_id, source_type, status);

create index if not exists idx_credit_usage_user_type_created_at
  on public.credit_usage (user_id, credit_type, created_at);

create index if not exists idx_credit_usage_grant_id
  on public.credit_usage (credit_grant_id);

alter table public.credit_grants enable row level security;
alter table public.credit_usage enable row level security;

create policy "Users read own credit grants"
  on public.credit_grants
  for select
  using (auth.uid() = user_id);

create policy "Users read own credit usage"
  on public.credit_usage
  for select
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_grants_updated_at on public.credit_grants;
create trigger trg_credit_grants_updated_at
before update on public.credit_grants
for each row execute function public.set_updated_at();

-- TODO(Task 2B): add transactional consume_credits RPC with row locking.
-- TODO(Task 2C): evaluate server-side helpers for ledger consumption and reporting.
