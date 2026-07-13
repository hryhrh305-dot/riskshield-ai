-- Secwyn authoritative credit ledger.
-- Existing migrations are intentionally left immutable. This migration is additive
-- and preserves profiles.credits_remaining as a server-maintained compatibility mirror.
-- Production preflight (read-only):
-- select plan, subscription_status, count(*), sum(credits_remaining)
-- from public.profiles group by plan, subscription_status order by plan, subscription_status;
-- select version from supabase_migrations.schema_migrations order by version;
-- If public.credit_grants already exists outside migration history, stop and audit its
-- columns/constraints against this migration before applying; IF NOT EXISTS is not a schema upgrade.

create table if not exists public.credit_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  operation_type text not null check (operation_type in ('grant','consume','reserve','release','finalize','reconcile')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  request_fingerprint text not null check (length(request_fingerprint) between 1 and 128),
  requested_amount integer not null check (requested_amount >= 0),
  operation_context jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation_type, idempotency_key)
);

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  credit_type text not null default 'contact_audit' check (credit_type in ('contact_audit','client_report')),
  source_type text not null check (source_type in ('subscription','free_cycle','referral_bonus','manual','backfill')),
  source_ref text not null check (length(source_ref) between 1 and 240),
  granted_amount integer not null check (granted_amount > 0),
  remaining_amount integer not null check (remaining_amount between 0 and granted_amount),
  starts_at timestamptz not null,
  expires_at timestamptz,
  subscription_ref text,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  status text not null default 'active' check (status in ('active','consumed','expired','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_ref),
  check (expires_at is null or expires_at > starts_at),
  check (billing_period_end is null or (billing_period_start is not null and billing_period_end > billing_period_start)),
  check (source_type <> 'subscription' or
    (subscription_ref is not null and billing_period_start is not null and billing_period_end is not null))
);

create unique index if not exists credit_grants_subscription_cycle_uidx
  on public.credit_grants (user_id, credit_type, subscription_ref, billing_period_start)
  where source_type = 'subscription';

create table if not exists public.credit_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null references public.credit_operations(id) on delete restrict,
  grant_id uuid not null references public.credit_grants(id) on delete restrict,
  amount integer not null check (amount > 0),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (operation_id, grant_id)
);

create table if not exists public.credit_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  bulk_run_id uuid not null references public.bulk_runs(id) on delete restrict,
  operation_id uuid not null references public.credit_operations(id) on delete restrict,
  grant_id uuid not null references public.credit_grants(id) on delete restrict,
  reserved_amount integer not null check (reserved_amount > 0),
  consumed_amount integer not null default 0 check (consumed_amount >= 0),
  released_amount integer not null default 0 check (released_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bulk_run_id, grant_id),
  check (consumed_amount + released_amount <= reserved_amount)
);

create index if not exists credit_grants_spend_idx
  on public.credit_grants (user_id, source_type, expires_at, starts_at, created_at)
  where status = 'active' and remaining_amount > 0;
create index if not exists credit_usage_user_idx on public.credit_usage (user_id, created_at desc);
create index if not exists credit_reservation_run_idx on public.credit_reservation_allocations (bulk_run_id);

alter table public.credit_operations enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_usage enable row level security;
alter table public.credit_reservation_allocations enable row level security;

revoke all on table public.credit_operations, public.credit_grants, public.credit_usage,
  public.credit_reservation_allocations from public, anon, authenticated;
grant select, insert, update on table public.credit_operations, public.credit_grants,
  public.credit_reservation_allocations to service_role;
grant select, insert on table public.credit_usage to service_role;

create or replace function public.lock_credit_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'CREDIT_USER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.sync_credit_mirror(p_user_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_total_remaining integer;
begin
  select coalesce(sum(remaining_amount), 0)::integer into v_total_remaining
  from public.credit_grants
  where user_id = p_user_id and credit_type='contact_audit' and status = 'active' and remaining_amount > 0
    and starts_at <= now() and (expires_at is null or expires_at > now());
  update public.profiles set credits_remaining = v_total_remaining, updated_at = now()
  where id = p_user_id;
  return v_total_remaining;
end;
$$;

create or replace function public.get_credit_summary(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_subscription integer; v_referral integer; v_manual integer; v_total_remaining integer; v_nearest timestamptz;
begin
  select
    coalesce(sum(remaining_amount) filter (where source_type in ('subscription','free_cycle')),0)::integer,
    coalesce(sum(remaining_amount) filter (where source_type = 'referral_bonus'),0)::integer,
    coalesce(sum(remaining_amount) filter (where source_type in ('manual','backfill')),0)::integer,
    coalesce(sum(remaining_amount),0)::integer,
    min(expires_at) filter (where expires_at is not null)
  into v_subscription, v_referral, v_manual, v_total_remaining, v_nearest
  from public.credit_grants
  where user_id = p_user_id and credit_type='contact_audit' and status = 'active' and remaining_amount > 0
    and starts_at <= now() and (expires_at is null or expires_at > now());
  return jsonb_build_object('subscription',v_subscription,'referral',v_referral,'manual',v_manual,
    'total',v_total_remaining,'nearestExpiry',v_nearest);
end;
$$;

create or replace function public.grant_cycle_credits(
  p_user_id uuid, p_credit_type text, p_source_type text, p_source_ref text, p_amount integer,
  p_starts_at timestamptz, p_expires_at timestamptz, p_fingerprint text,
  p_subscription_ref text default null, p_billing_period_start timestamptz default null,
  p_billing_period_end timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.credit_operations; v_grant public.credit_grants; v_total_remaining integer;
begin
  if p_amount <= 0 or p_credit_type not in ('contact_audit','client_report') or p_source_ref is null
    or p_fingerprint is null or (p_expires_at is not null and p_expires_at<=p_starts_at)
    or (p_source_type='subscription' and (p_subscription_ref is null or p_billing_period_start is null
      or p_billing_period_end is null or p_billing_period_end<=p_billing_period_start)) then
    raise exception 'INVALID_CREDIT_GRANT';
  end if;
  perform public.lock_credit_user(p_user_id);
  select * into v_operation from public.credit_operations
   where user_id=p_user_id and operation_type='grant' and idempotency_key=p_source_ref for update;
  if found then
    if v_operation.operation_context->>'sourceType' is distinct from p_source_type
      or v_operation.operation_context->>'creditType' is distinct from p_credit_type then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_grant from public.credit_grants where id=(v_operation.result->>'grantId')::uuid
      and user_id=p_user_id
      and source_ref=p_source_ref for update;
    if not found then raise exception 'CREDIT_LEDGER_INVARIANT_VIOLATION'; end if;
    if v_operation.request_fingerprint is distinct from p_fingerprint or v_operation.requested_amount is distinct from p_amount
      or v_grant.credit_type is distinct from p_credit_type or v_grant.source_type is distinct from p_source_type
      or v_grant.starts_at is distinct from p_starts_at
      or v_grant.expires_at is distinct from p_expires_at
      or v_grant.subscription_ref is distinct from p_subscription_ref
      or v_grant.billing_period_start is distinct from p_billing_period_start
      or v_grant.billing_period_end is distinct from p_billing_period_end
      or v_grant.metadata is distinct from coalesce(p_metadata,'{}'::jsonb) then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_operation.result;
  end if;
  insert into public.credit_operations(user_id,operation_type,idempotency_key,request_fingerprint,requested_amount,operation_context)
    values(p_user_id,'grant',p_source_ref,p_fingerprint,p_amount,jsonb_build_object('creditType',p_credit_type,'sourceType',p_source_type)) returning * into v_operation;
  insert into public.credit_grants(user_id,credit_type,source_type,source_ref,granted_amount,remaining_amount,starts_at,
    expires_at,subscription_ref,billing_period_start,billing_period_end,metadata)
    values(p_user_id,p_credit_type,p_source_type,p_source_ref,p_amount,p_amount,p_starts_at,p_expires_at,
      p_subscription_ref,p_billing_period_start,p_billing_period_end,coalesce(p_metadata,'{}'::jsonb))
    returning * into v_grant;
  v_total_remaining := public.sync_credit_mirror(p_user_id);
  update public.credit_operations set result=jsonb_build_object('grantId',v_grant.id,'granted',p_amount,'remaining',v_total_remaining),completed_at=now()
    where id=v_operation.id returning * into v_operation;
  return v_operation.result;
end;
$$;

create or replace function public.consume_grant_credits(
  p_user_id uuid, p_credit_type text, p_amount integer, p_idempotency_key text, p_fingerprint text,
  p_context jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.credit_operations; v_available integer; v_needed integer; v_take integer;
  v_grant public.credit_grants; v_total_remaining integer;
begin
  if p_amount <= 0 or p_credit_type not in ('contact_audit','client_report') or p_idempotency_key is null or p_fingerprint is null then raise exception 'INVALID_CREDIT_CONSUMPTION'; end if;
  perform public.lock_credit_user(p_user_id);
  select * into v_operation from public.credit_operations where user_id=p_user_id and operation_type='consume'
    and idempotency_key=p_idempotency_key for update;
  if found then
    if v_operation.request_fingerprint is distinct from p_fingerprint or v_operation.requested_amount is distinct from p_amount
      or v_operation.operation_context is distinct from jsonb_build_object('creditType',p_credit_type,'context',coalesce(p_context,'{}'::jsonb))
      then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_operation.result;
  end if;
  select coalesce(sum(remaining_amount),0)::integer into v_available from public.credit_grants
   where user_id=p_user_id and credit_type=p_credit_type and status='active' and remaining_amount>0 and starts_at<=now()
     and (expires_at is null or expires_at>now());
  if v_available < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into public.credit_operations(user_id,operation_type,idempotency_key,request_fingerprint,requested_amount,operation_context)
    values(p_user_id,'consume',p_idempotency_key,p_fingerprint,p_amount,
      jsonb_build_object('creditType',p_credit_type,'context',coalesce(p_context,'{}'::jsonb))) returning * into v_operation;
  v_needed := p_amount;
  for v_grant in select * from public.credit_grants where user_id=p_user_id and credit_type=p_credit_type and status='active' and remaining_amount>0
    and starts_at<=now() and (expires_at is null or expires_at>now())
    order by case when source_type = 'referral_bonus' then 0 when source_type in ('subscription','free_cycle') then 1 else 2 end,
      expires_at asc nulls last, starts_at, created_at, id for update
  loop
    exit when v_needed=0; v_take:=least(v_needed,v_grant.remaining_amount);
    update public.credit_grants set remaining_amount=remaining_amount-v_take,
      status=case when remaining_amount-v_take=0 then 'consumed' else status end,updated_at=now() where id=v_grant.id;
    insert into public.credit_usage(user_id,operation_id,grant_id,amount,context)
      values(p_user_id,v_operation.id,v_grant.id,v_take,coalesce(p_context,'{}'::jsonb));
    v_needed:=v_needed-v_take;
  end loop;
  v_total_remaining:=public.sync_credit_mirror(p_user_id);
  update public.credit_operations set result=jsonb_build_object('deducted',p_amount,'remaining',v_total_remaining),completed_at=now()
    where id=v_operation.id returning * into v_operation;
  return v_operation.result;
end;
$$;

create or replace function public.reserve_grant_credits(
  p_user_id uuid, p_bulk_run_id uuid, p_credit_type text, p_amount integer, p_idempotency_key text, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.credit_operations; v_available integer; v_needed integer; v_take integer;
  v_grant public.credit_grants; v_total_remaining integer;
begin
  if p_amount<=0 or p_credit_type not in ('contact_audit','client_report') or p_idempotency_key is null
    or p_fingerprint is null then raise exception 'INVALID_CREDIT_RESERVATION'; end if;
  perform public.lock_credit_user(p_user_id);
  perform 1 from public.bulk_runs where id=p_bulk_run_id and user_id=p_user_id for update;
  if not found then raise exception 'BULK_RUN_NOT_FOUND'; end if;
  select * into v_operation from public.credit_operations where user_id=p_user_id and operation_type='reserve'
    and idempotency_key=p_idempotency_key for update;
  if found then
    if v_operation.request_fingerprint<>p_fingerprint or v_operation.requested_amount<>p_amount
      or v_operation.operation_context->>'bulkRunId'<>p_bulk_run_id::text
      or v_operation.operation_context->>'creditType'<>p_credit_type then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_operation.result;
  end if;
  select coalesce(sum(remaining_amount),0)::integer into v_available from public.credit_grants
   where user_id=p_user_id and credit_type=p_credit_type and status='active' and remaining_amount>0 and starts_at<=now()
     and (expires_at is null or expires_at>now());
  if v_available<p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into public.credit_operations(user_id,operation_type,idempotency_key,request_fingerprint,requested_amount,operation_context)
    values(p_user_id,'reserve',p_idempotency_key,p_fingerprint,p_amount,
      jsonb_build_object('bulkRunId',p_bulk_run_id,'creditType',p_credit_type)) returning * into v_operation;
  v_needed:=p_amount;
  for v_grant in select * from public.credit_grants where user_id=p_user_id and credit_type=p_credit_type and status='active' and remaining_amount>0
    and starts_at<=now() and (expires_at is null or expires_at>now())
    order by case when source_type = 'referral_bonus' then 0 when source_type in ('subscription','free_cycle') then 1 else 2 end,
      expires_at asc nulls last,starts_at,created_at,id for update
  loop
    exit when v_needed=0; v_take:=least(v_needed,v_grant.remaining_amount);
    update public.credit_grants set remaining_amount=remaining_amount-v_take,
      status=case when remaining_amount-v_take=0 then 'consumed' else status end,updated_at=now() where id=v_grant.id;
    insert into public.credit_reservation_allocations(user_id,bulk_run_id,operation_id,grant_id,reserved_amount)
      values(p_user_id,p_bulk_run_id,v_operation.id,v_grant.id,v_take);
    v_needed:=v_needed-v_take;
  end loop;
  v_total_remaining:=public.sync_credit_mirror(p_user_id);
  update public.credit_operations set result=jsonb_build_object('reserved',p_amount,'remaining',v_total_remaining),completed_at=now()
    where id=v_operation.id returning * into v_operation;
  return v_operation.result;
end;
$$;

create or replace function public.release_grant_reservation(
  p_user_id uuid, p_bulk_run_id uuid, p_amount integer, p_idempotency_key text, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.credit_operations; v_left integer; v_release integer; v_allocation public.credit_reservation_allocations;
  v_total_remaining integer; v_updated integer;
begin
  if p_amount<=0 or p_idempotency_key is null or p_fingerprint is null then raise exception 'INVALID_CREDIT_RELEASE'; end if;
  perform public.lock_credit_user(p_user_id);
  perform 1 from public.bulk_runs where id=p_bulk_run_id and user_id=p_user_id for update;
  if not found then raise exception 'BULK_RUN_NOT_FOUND'; end if;
  select * into v_operation from public.credit_operations where user_id=p_user_id and operation_type='release'
    and idempotency_key=p_idempotency_key for update;
  if found then
    if v_operation.request_fingerprint<>p_fingerprint or v_operation.requested_amount<>p_amount
      or v_operation.operation_context->>'bulkRunId'<>p_bulk_run_id::text then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_operation.result;
  end if;
  insert into public.credit_operations(user_id,operation_type,idempotency_key,request_fingerprint,requested_amount,operation_context)
    values(p_user_id,'release',p_idempotency_key,p_fingerprint,p_amount,jsonb_build_object('bulkRunId',p_bulk_run_id)) returning * into v_operation;
  v_left:=p_amount;
  for v_allocation in select * from public.credit_reservation_allocations where bulk_run_id=p_bulk_run_id
    and user_id=p_user_id and consumed_amount+released_amount<reserved_amount order by created_at,id for update
  loop
    exit when v_left=0;
    v_release:=least(v_left,v_allocation.reserved_amount-v_allocation.consumed_amount-v_allocation.released_amount);
    update public.credit_grants set remaining_amount=remaining_amount+v_release,
      status=case when status='consumed' and (expires_at is null or expires_at>now()) then 'active' else status end,updated_at=now()
      where id=v_allocation.grant_id and remaining_amount+v_release<=granted_amount;
    get diagnostics v_updated = row_count;
    if v_updated<>1 then raise exception 'CREDIT_GRANT_RELEASE_FAILED'; end if;
    update public.credit_reservation_allocations set released_amount=released_amount+v_release,updated_at=now() where id=v_allocation.id;
    v_left:=v_left-v_release;
  end loop;
  if v_left<>0 then raise exception 'RELEASE_EXCEEDS_RESERVATION'; end if;
  v_total_remaining:=public.sync_credit_mirror(p_user_id);
  update public.credit_operations set result=jsonb_build_object('released',p_amount,'remaining',v_total_remaining),completed_at=now()
    where id=v_operation.id returning * into v_operation;
  return v_operation.result;
end;
$$;

create or replace function public.protect_profile_credit_mirror()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.credits_remaining is distinct from old.credits_remaining and (
    current_user in ('anon','authenticated')
    or coalesce(auth.role()::text,'') in ('anon','authenticated')
    or coalesce(current_setting('request.jwt.claim.role', true),'') in ('anon','authenticated')
  ) then
    raise exception 'CREDIT_MIRROR_IS_SERVER_MANAGED';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_credit_mirror on public.profiles;
create trigger protect_profile_credit_mirror before update of credits_remaining on public.profiles
for each row execute function public.protect_profile_credit_mirror();

create or replace function public.validate_credit_usage_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_operation_type text; v_requested integer; v_used integer;
begin
  if not exists (select 1 from public.credit_grants where id=new.grant_id and user_id=new.user_id)
    or not exists (select 1 from public.credit_operations where id=new.operation_id and user_id=new.user_id) then
    raise exception 'CREDIT_USAGE_USER_MISMATCH';
  end if;
  select operation_type,requested_amount into v_operation_type,v_requested
    from public.credit_operations where id=new.operation_id for update;
  if not found then raise exception 'CREDIT_USAGE_OPERATION_NOT_FOUND'; end if;
  if v_operation_type not in ('consume','finalize') then raise exception 'INVALID_CREDIT_USAGE_OPERATION'; end if;
  select coalesce(sum(amount),0)::integer into v_used from public.credit_usage where operation_id=new.operation_id;
  if v_used+new.amount>v_requested then raise exception 'CREDIT_USAGE_EXCEEDS_OPERATION'; end if;
  return new;
end;
$$;
drop trigger if exists validate_credit_usage_insert on public.credit_usage;
create trigger validate_credit_usage_insert before insert on public.credit_usage
for each row execute function public.validate_credit_usage_insert();

create or replace function public.prevent_credit_usage_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'CREDIT_USAGE_IS_IMMUTABLE';
end;
$$;
drop trigger if exists prevent_credit_usage_mutation on public.credit_usage;
create trigger prevent_credit_usage_mutation before update or delete on public.credit_usage
for each row execute function public.prevent_credit_usage_mutation();

do $$ begin
  if to_regprocedure('public.consume_credit(uuid)') is not null then
    execute 'revoke execute on function public.consume_credit(uuid) from public, anon, authenticated';
  end if;
end $$;

revoke all on function public.lock_credit_user(uuid), public.sync_credit_mirror(uuid),
  public.get_credit_summary(uuid), public.grant_cycle_credits(uuid,text,text,text,integer,timestamptz,timestamptz,text,text,timestamptz,timestamptz,jsonb),
  public.consume_grant_credits(uuid,text,integer,text,text,jsonb), public.reserve_grant_credits(uuid,uuid,text,integer,text,text),
  public.release_grant_reservation(uuid,uuid,integer,text,text), public.protect_profile_credit_mirror(),
  public.validate_credit_usage_insert(), public.prevent_credit_usage_mutation()
  from public, anon, authenticated;
grant execute on function public.get_credit_summary(uuid),
  public.grant_cycle_credits(uuid,text,text,text,integer,timestamptz,timestamptz,text,text,timestamptz,timestamptz,jsonb),
  public.consume_grant_credits(uuid,text,integer,text,text,jsonb), public.reserve_grant_credits(uuid,uuid,text,integer,text,text),
  public.release_grant_reservation(uuid,uuid,integer,text,text) to service_role;
