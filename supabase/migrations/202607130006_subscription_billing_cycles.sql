alter table public.subscriptions
  add column if not exists billing_interval text check (billing_interval in ('monthly','yearly')),
  add column if not exists credit_anchor_at timestamptz,
  add column if not exists paid_through timestamptz,
  add column if not exists billing_terminal_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active','cancelled','expired','past_due','paused'));
alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('inactive','active','cancelled','expired','past_due','paused'));
alter table public.profiles add column if not exists current_subscription_ref text;

create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(payment_provider,provider_subscription_id)
  where provider_subscription_id is not null;
create unique index if not exists payments_provider_transaction_uidx
  on public.payments(provider,provider_transaction_id)
  where provider_transaction_id is not null;

drop index if exists public.credit_grants_subscription_cycle_uidx;
create unique index credit_grants_subscription_cycle_uidx
  on public.credit_grants(user_id,credit_type,subscription_ref,billing_period_start,((metadata->>'plan')))
  where source_type='subscription';

revoke insert,update,delete on public.credit_grants,public.credit_operations,
  public.credit_reservation_allocations from service_role;
revoke insert,update,delete on public.credit_usage from service_role;
revoke execute on function public.grant_cycle_credits(uuid,text,text,text,integer,timestamptz,timestamptz,text,text,timestamptz,timestamptz,jsonb)
  from service_role;

drop function if exists public.grant_subscription_cycle_credits(uuid,text,text,integer,timestamptz,timestamptz,text,timestamptz);
create or replace function public.grant_subscription_cycle_credits(
  p_user_id uuid,p_subscription_ref text,p_plan text,p_amount integer,p_starts_at timestamptz,
  p_expires_at timestamptz,p_fingerprint text,p_anchor timestamptz,p_paid_through timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_existing_grant public.credit_grants; v_current_plan text; v_current_start timestamptz; v_current_ref text;
  v_current_rank integer; v_new_rank integer;
begin
  if p_plan not in ('starter','growth','scale') or p_paid_through is null or p_paid_through<=p_starts_at
    then raise exception 'INVALID_SUBSCRIPTION_PLAN_OR_PERIOD'; end if;
  perform public.lock_credit_user(p_user_id);
  select plan,subscription_start,current_subscription_ref into v_current_plan,v_current_start,v_current_ref
    from public.profiles where id=p_user_id for update;
  v_current_rank:=case v_current_plan when 'business' then 4 when 'scale' then 3 when 'growth' then 2 when 'starter' then 1 else 0 end;
  v_new_rank:=case p_plan when 'scale' then 3 when 'growth' then 2 when 'starter' then 1 else 0 end;
  if v_current_start is not null and (p_starts_at<v_current_start
    or (p_starts_at=v_current_start and v_new_rank<v_current_rank)
    or (p_starts_at<=v_current_start and v_current_ref is not null and v_current_ref is distinct from p_subscription_ref))
    then raise exception 'STALE_SUBSCRIPTION_PAID_EVENT'; end if;
  perform 1 from public.subscriptions where user_id=p_user_id and provider_subscription_id=p_subscription_ref for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if exists(select 1 from public.subscriptions where user_id=p_user_id and provider_subscription_id=p_subscription_ref
    and billing_terminal_at is not null and p_starts_at<=billing_terminal_at) then raise exception 'STALE_SUBSCRIPTION_PAID_EVENT'; end if;
  perform 1 from public.credit_grants where user_id=p_user_id and source_type in ('subscription','free_cycle') and status='active' for update;
  update public.credit_grants set status='revoked',remaining_amount=0,updated_at=now(),
    metadata=metadata||jsonb_build_object('replacedAt',now(),'replacedByPlan',p_plan)
    where user_id=p_user_id and source_type in ('subscription','free_cycle') and status='active'
      and starts_at<=now() and (expires_at is null or expires_at>now())
      and (subscription_ref is distinct from p_subscription_ref or metadata->>'plan' is distinct from p_plan);
  select * into v_existing_grant from public.credit_grants where user_id=p_user_id and source_type='subscription'
    and subscription_ref=p_subscription_ref and billing_period_start=p_starts_at and metadata->>'plan'=p_plan for update;
  if found then
    if v_existing_grant.granted_amount<>p_amount or v_existing_grant.expires_at is distinct from p_expires_at then
      raise exception 'SUBSCRIPTION_CYCLE_CONFLICT';
    end if;
    v_result:=jsonb_build_object('grantId',v_existing_grant.id,'granted',0,'replayed',true);
  else
    v_result:=public.grant_cycle_credits(p_user_id,'contact_audit','subscription',
      'subscription:'||p_subscription_ref||':'||p_starts_at::text||':'||p_plan,p_amount,p_starts_at,p_expires_at,
      p_fingerprint,p_subscription_ref,p_starts_at,p_expires_at,jsonb_build_object('plan',p_plan,'anchor',p_anchor));
  end if;
  update public.subscriptions set plan=p_plan,status='active',credit_anchor_at=coalesce(credit_anchor_at,p_anchor),
    current_period_start=p_starts_at,paid_through=p_paid_through,billing_terminal_at=null,updated_at=now()
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref;
  update public.profiles set plan=p_plan,subscription_status='active',subscription_start=p_starts_at,
    subscription_end=p_paid_through,current_subscription_ref=p_subscription_ref,updated_at=now() where id=p_user_id;
  return v_result;
end $$;

drop function if exists public.revoke_subscription_credits(uuid,text,text);
create or replace function public.revoke_subscription_credits(
  p_user_id uuid,p_subscription_ref text,p_reason text,p_terminal_status text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revoked integer; v_remaining integer;
begin
  if p_subscription_ref is null or p_terminal_status not in ('cancelled','paused') then raise exception 'INVALID_SUBSCRIPTION_REVERSAL'; end if;
  perform public.lock_credit_user(p_user_id);
  perform 1 from public.subscriptions where user_id=p_user_id and provider_subscription_id=p_subscription_ref for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  perform 1 from public.credit_grants
    where user_id=p_user_id and source_type='subscription' and subscription_ref=p_subscription_ref
      and status in ('active','consumed') for update;
  select coalesce(sum(remaining_amount),0)::integer into v_revoked from public.credit_grants
    where user_id=p_user_id and source_type='subscription' and subscription_ref=p_subscription_ref
      and status in ('active','consumed');
  update public.credit_grants set status='revoked',remaining_amount=0,updated_at=now(),
      metadata=metadata||jsonb_build_object('revokedReason',left(coalesce(p_reason,'billing_reversal'),200),'revokedAt',now())
    where user_id=p_user_id and source_type='subscription' and subscription_ref=p_subscription_ref
      and status in ('active','consumed');
  update public.subscriptions set status=p_terminal_status,current_period_end=now(),cancelled_at=now(),
    billing_terminal_at=now(),cancel_at_period_end=false,updated_at=now()
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref;
  v_remaining:=public.sync_credit_mirror(p_user_id);
  update public.profiles set plan='free',subscription_status=p_terminal_status,subscription_end=now(),
    current_subscription_ref=null,updated_at=now()
    where id=p_user_id and (current_subscription_ref=p_subscription_ref or (
      current_subscription_ref is null and not exists (
        select 1 from public.credit_grants where user_id=p_user_id and source_type='subscription'
          and subscription_ref is distinct from p_subscription_ref and status='active'
          and starts_at<=now() and (expires_at is null or expires_at>now())
      )
    ));
  return jsonb_build_object('revoked',v_revoked,'remaining',v_remaining);
end $$;

revoke all on function public.revoke_subscription_credits(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.revoke_subscription_credits(uuid,text,text,text) to service_role;
revoke all on function public.grant_subscription_cycle_credits(uuid,text,text,integer,timestamptz,timestamptz,text,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.grant_subscription_cycle_credits(uuid,text,text,integer,timestamptz,timestamptz,text,timestamptz,timestamptz)
  to service_role;

create or replace function public.grant_free_cycle_credits(
  p_user_id uuid,p_anchor timestamptz,p_starts_at timestamptz,p_expires_at timestamptz,p_fingerprint text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_existing_grant public.credit_grants;
begin
  perform public.lock_credit_user(p_user_id);
  if not exists(select 1 from public.profiles where id=p_user_id and plan='free') then
    raise exception 'FREE_CYCLE_USER_NOT_FREE';
  end if;
  perform 1 from public.credit_grants where user_id=p_user_id and source_type='free_cycle' for update;
  update public.credit_grants set status='expired',remaining_amount=0,updated_at=now(),
    metadata=metadata||jsonb_build_object('expiredByCycle',p_starts_at)
    where user_id=p_user_id and source_type='free_cycle' and status='active'
      and starts_at is distinct from p_starts_at;
  select * into v_existing_grant from public.credit_grants where user_id=p_user_id and source_type='free_cycle'
    and starts_at=p_starts_at for update;
  if found then
    if v_existing_grant.granted_amount<>50 or v_existing_grant.expires_at is distinct from p_expires_at then
      raise exception 'FREE_CYCLE_CONFLICT';
    end if;
    v_result:=jsonb_build_object('grantId',v_existing_grant.id,'granted',0,'replayed',true);
  else
    v_result:=public.grant_cycle_credits(p_user_id,'contact_audit','free_cycle',
      'free:'||p_user_id::text||':'||p_starts_at::text,50,p_starts_at,p_expires_at,p_fingerprint,
      null,null,null,jsonb_build_object('plan','free','anchor',p_anchor));
  end if;
  perform public.sync_credit_mirror(p_user_id);
  return v_result;
end $$;
revoke all on function public.grant_free_cycle_credits(uuid,timestamptz,timestamptz,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.grant_free_cycle_credits(uuid,timestamptz,timestamptz,timestamptz,text)
  to service_role;
