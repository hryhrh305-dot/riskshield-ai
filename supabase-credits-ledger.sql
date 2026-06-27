-- Task 2B draft only.
-- Do not execute automatically.
-- Review manually before running in Supabase SQL Editor.
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
create or replace function public.consume_ledger_credits(
  p_user_id uuid,
  p_workspace_id uuid default null,
  p_credit_type text,
  p_amount integer,
  p_usage_reason text,
  p_related_audit_id uuid default null,
  p_related_report_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_total_available integer := 0;
  v_required integer := coalesce(p_amount, 0);
  v_allocations jsonb := '[]'::jsonb;
  v_grant record;
  v_use integer;
begin
  if v_required <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Requested credit amount must be greater than zero.',
      'requiredAmount', v_required,
      'availableAmount', 0
    );
  end if;

  if p_credit_type not in ('contact_audit', 'client_report') then
    raise exception 'Invalid credit type: %', p_credit_type;
  end if;

  if p_usage_reason not in (
    'audit_contacts',
    'export_client_report',
    'api_audit',
    'sheets_audit',
    'small_report_audit',
    'refund_reversal',
    'manual_adjustment'
  ) then
    raise exception 'Invalid usage reason: %', p_usage_reason;
  end if;

  for v_grant in
    select *
    from public.credit_grants
    where user_id = p_user_id
      and credit_type = p_credit_type
      and status = 'active'
      and remaining_amount > 0
      and starts_at <= v_now
      and (expires_at is null or expires_at > v_now)
      and (
        (p_workspace_id is null and workspace_id is null)
        or (p_workspace_id is not null and workspace_id = p_workspace_id)
      )
    order by expires_at nulls last, created_at asc
    for update skip locked
  loop
    v_total_available := v_total_available + v_grant.remaining_amount;
  end loop;

  if v_total_available < v_required then
    return jsonb_build_object(
      'ok', false,
      'error',
      case
        when p_credit_type = 'contact_audit' then 'Not enough audit capacity. Add top-up credits or upgrade your plan.'
        else 'No client-ready report credits remaining. Add extra report credits or upgrade your plan.'
      end,
      'requiredAmount', v_required,
      'availableAmount', v_total_available
    );
  end if;

  for v_grant in
    select *
    from public.credit_grants
    where user_id = p_user_id
      and credit_type = p_credit_type
      and status = 'active'
      and remaining_amount > 0
      and starts_at <= v_now
      and (expires_at is null or expires_at > v_now)
      and (
        (p_workspace_id is null and workspace_id is null)
        or (p_workspace_id is not null and workspace_id = p_workspace_id)
      )
    order by expires_at nulls last, created_at asc
    for update skip locked
  loop
    exit when v_required <= 0;

    v_use := least(v_grant.remaining_amount, v_required);

    update public.credit_grants
      set remaining_amount = remaining_amount - v_use,
          status = case
            when remaining_amount - v_use = 0 then 'consumed'
            else 'active'
          end,
          updated_at = v_now
    where id = v_grant.id;

    insert into public.credit_usage (
      user_id,
      workspace_id,
      credit_grant_id,
      credit_type,
      amount_used,
      usage_reason,
      related_audit_id,
      related_report_id,
      metadata,
      created_at
    ) values (
      p_user_id,
      p_workspace_id,
      v_grant.id,
      p_credit_type,
      v_use,
      p_usage_reason,
      p_related_audit_id,
      p_related_report_id,
      coalesce(p_metadata, '{}'::jsonb),
      v_now
    );

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object(
        'creditGrantId', v_grant.id,
        'creditType', p_credit_type,
        'amountUsed', v_use,
        'usageReason', p_usage_reason,
        'remainingAfterUse', greatest(v_grant.remaining_amount - v_use, 0)
      )
    );

    v_required := v_required - v_use;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'totalUsed', p_amount,
    'allocations', v_allocations
  );
end;
$$;

-- TODO(Task 2C): evaluate server-side helpers for ledger consumption and reporting.
