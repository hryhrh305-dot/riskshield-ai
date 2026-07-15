-- Exact Creem transaction-to-grant linkage and idempotent, transaction-scoped reversal.
-- This migration is additive: the existing grant/revoke RPC signatures remain available
-- during rollout, while the application moves to the transaction-aware overloads.

alter table public.credit_grants
  add column if not exists provider_transaction_id text,
  add column if not exists reversal_ref text;

create unique index if not exists credit_grants_provider_transaction_uidx
  on public.credit_grants(provider_transaction_id,billing_period_start)
  where source_type = 'subscription' and provider_transaction_id is not null;

create index if not exists credit_grants_reversal_ref_idx
  on public.credit_grants(reversal_ref)
  where reversal_ref is not null;

create or replace function public.grant_subscription_cycle_credits(
  p_user_id uuid,p_subscription_ref text,p_plan text,p_amount integer,p_starts_at timestamptz,
  p_expires_at timestamptz,p_fingerprint text,p_anchor timestamptz,p_paid_through timestamptz,
  p_provider_transaction_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb;
  v_existing_grant public.credit_grants;
  v_current_plan text;
  v_current_start timestamptz;
  v_current_ref text;
  v_current_rank integer;
  v_new_rank integer;
  v_grant_id uuid;
begin
  if p_plan not in ('starter','growth','scale')
    or p_paid_through is null or p_paid_through <= p_starts_at
    or p_provider_transaction_id is null
    or btrim(p_provider_transaction_id) = ''
    or length(p_provider_transaction_id) > 200
  then raise exception 'INVALID_SUBSCRIPTION_PLAN_PERIOD_OR_TRANSACTION'; end if;

  perform public.lock_credit_user(p_user_id);
  select plan,subscription_start,current_subscription_ref
    into v_current_plan,v_current_start,v_current_ref
    from public.profiles where id=p_user_id for update;
  v_current_rank:=case v_current_plan when 'business' then 4 when 'scale' then 3 when 'growth' then 2 when 'starter' then 1 else 0 end;
  v_new_rank:=case p_plan when 'scale' then 3 when 'growth' then 2 when 'starter' then 1 else 0 end;

  if v_current_start is not null and (p_starts_at<v_current_start
    or (p_starts_at=v_current_start and v_new_rank<v_current_rank)
    or (p_starts_at<=v_current_start and v_current_ref is not null and v_current_ref is distinct from p_subscription_ref))
  then raise exception 'STALE_SUBSCRIPTION_PAID_EVENT'; end if;

  perform 1 from public.payments
    where user_id=p_user_id and provider='creem'
      and provider_transaction_id=p_provider_transaction_id and status='completed'
    for update;
  if not found then raise exception 'COMPLETED_PAYMENT_NOT_FOUND'; end if;

  perform 1 from public.subscriptions
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if exists(select 1 from public.subscriptions
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref
      and billing_terminal_at is not null and p_starts_at<=billing_terminal_at)
  then raise exception 'STALE_SUBSCRIPTION_PAID_EVENT'; end if;

  perform 1 from public.credit_grants
    where user_id=p_user_id and source_type in ('subscription','free_cycle') and status='active'
    for update;
  update public.credit_grants
    set status='revoked',remaining_amount = 0,updated_at=now(),
      metadata=metadata||jsonb_build_object(
        'replacedAt',now(),
        'replacedByPlan',p_plan,
        'replacedRemaining',greatest(0,remaining_amount),
        'replacedByTransactionId',p_provider_transaction_id
      )
    where user_id=p_user_id and source_type in ('subscription','free_cycle') and status='active'
      and starts_at<=now() and (expires_at is null or expires_at>now())
      and (subscription_ref is distinct from p_subscription_ref or metadata->>'plan' is distinct from p_plan);

  select * into v_existing_grant from public.credit_grants
    where user_id=p_user_id and source_type='subscription'
      and subscription_ref=p_subscription_ref and billing_period_start=p_starts_at
      and metadata->>'plan'=p_plan for update;
  if found then
    if v_existing_grant.granted_amount<>p_amount
      or v_existing_grant.expires_at is distinct from p_expires_at
      or (v_existing_grant.provider_transaction_id is not null
        and v_existing_grant.provider_transaction_id is distinct from p_provider_transaction_id)
    then raise exception 'SUBSCRIPTION_CYCLE_CONFLICT'; end if;
    if v_existing_grant.provider_transaction_id is null then
      update public.credit_grants set provider_transaction_id=p_provider_transaction_id,updated_at=now()
        where id=v_existing_grant.id;
    end if;
    v_result:=jsonb_build_object('grantId',v_existing_grant.id,'granted',0,'replayed',true);
  else
    v_result:=public.grant_cycle_credits(
      p_user_id,'contact_audit','subscription',
      'subscription:'||p_subscription_ref||':'||p_starts_at::text||':'||p_plan,
      p_amount,p_starts_at,p_expires_at,p_fingerprint,p_subscription_ref,p_starts_at,p_expires_at,
      jsonb_build_object('plan',p_plan,'anchor',p_anchor,'providerTransactionId',p_provider_transaction_id)
    );
    v_grant_id:=(v_result->>'grantId')::uuid;
    update public.credit_grants
      set provider_transaction_id=p_provider_transaction_id,updated_at=now()
      where id=v_grant_id and user_id=p_user_id;
    if not found then raise exception 'SUBSCRIPTION_TRANSACTION_LINK_FAILED'; end if;
  end if;

  update public.subscriptions
    set plan=p_plan,status='active',credit_anchor_at=coalesce(credit_anchor_at,p_anchor),
      current_period_start=p_starts_at,paid_through=p_paid_through,billing_terminal_at=null,updated_at=now()
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref;
  update public.profiles
    set plan=p_plan,subscription_status='active',subscription_start=p_starts_at,
      subscription_end=p_paid_through,current_subscription_ref=p_subscription_ref,updated_at=now()
    where id=p_user_id;
  return v_result;
end $$;

revoke all on function public.grant_subscription_cycle_credits(
  uuid,text,text,integer,timestamptz,timestamptz,text,timestamptz,timestamptz,text
) from public,anon,authenticated;
grant execute on function public.grant_subscription_cycle_credits(
  uuid,text,text,integer,timestamptz,timestamptz,text,timestamptz,timestamptz,text
) to service_role;

create or replace function public.revoke_subscription_transaction_credits(
  p_user_id uuid,p_subscription_ref text,p_provider_transaction_id text,p_refund_ref text,
  p_reason text,p_terminal_status text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_revoked integer:=0;
  v_restored integer:=0;
  v_remaining integer:=0;
  v_restored_plan text;
  v_restored_ref text;
  v_restored_end timestamptz;
begin
  if p_subscription_ref is null or btrim(p_subscription_ref)=''
    or p_provider_transaction_id is null or btrim(p_provider_transaction_id)=''
    or p_refund_ref is null or btrim(p_refund_ref)=''
    or p_terminal_status not in ('cancelled','paused')
  then raise exception 'INVALID_SUBSCRIPTION_TRANSACTION_REVERSAL'; end if;

  perform public.lock_credit_user(p_user_id);
  perform 1 from public.credit_grants
    where user_id=p_user_id and source_type='subscription'
      and subscription_ref=p_subscription_ref
      and provider_transaction_id=p_provider_transaction_id
    for update;
  if not found then raise exception 'TRANSACTION_CREDIT_GRANT_NOT_FOUND'; end if;

  if exists(select 1 from public.credit_grants
    where reversal_ref=p_refund_ref and provider_transaction_id is distinct from p_provider_transaction_id)
  then raise exception 'REVERSAL_REFERENCE_CONFLICT'; end if;

  if not exists(select 1 from public.credit_grants
    where user_id=p_user_id and source_type='subscription'
      and subscription_ref=p_subscription_ref
      and provider_transaction_id=p_provider_transaction_id
      and reversal_ref is null)
  then
    v_remaining:=public.sync_credit_mirror(p_user_id);
    return jsonb_build_object(
      'revoked',0,'restored',0,'remaining',v_remaining,'replayed',true,
      'sameReversal',not exists(select 1 from public.credit_grants
        where user_id=p_user_id and source_type='subscription'
          and subscription_ref=p_subscription_ref
          and provider_transaction_id=p_provider_transaction_id
          and reversal_ref is distinct from p_refund_ref)
    );
  end if;

  update public.payments set status=case when p_terminal_status='paused' then 'failed' else 'refunded' end
    where user_id=p_user_id and provider='creem' and provider_transaction_id=p_provider_transaction_id;
  if not found then raise exception 'PAYMENT_TRANSACTION_NOT_FOUND'; end if;

  select coalesce(sum(greatest(0,remaining_amount)),0)::integer into v_revoked
    from public.credit_grants
    where user_id=p_user_id and source_type='subscription'
      and subscription_ref=p_subscription_ref
      and provider_transaction_id=p_provider_transaction_id
      and reversal_ref is null;
  update public.credit_grants
    set status='revoked',remaining_amount = 0,reversal_ref=p_refund_ref,updated_at=now(),
      metadata=metadata||jsonb_build_object(
        'revokedReason',left(coalesce(p_reason,'billing_reversal'),200),
        'revokedAt',now(),'reversalRef',p_refund_ref
      )
    where user_id=p_user_id and source_type='subscription'
      and subscription_ref=p_subscription_ref
      and provider_transaction_id=p_provider_transaction_id
      and reversal_ref is null;

  perform 1 from public.credit_grants
    where user_id=p_user_id and status='revoked'
      and metadata->>'replacedByTransactionId'=p_provider_transaction_id
    for update;
  update public.credit_grants
    set remaining_amount=least(
        granted_amount,
        greatest(0,coalesce((metadata->>'replacedRemaining')::integer,0))
      ),
      status=case
        when greatest(0,coalesce((metadata->>'replacedRemaining')::integer,0))>0 then 'active'
        else 'consumed'
      end,
      updated_at=now(),
      metadata=metadata||jsonb_build_object('restoredAt',now(),'restoredByReversalRef',p_refund_ref)
    where user_id=p_user_id and status='revoked'
      and metadata->>'replacedByTransactionId'=p_provider_transaction_id
      and starts_at<=now() and (expires_at is null or expires_at>now());
  get diagnostics v_restored = row_count;

  update public.subscriptions
    set status=p_terminal_status,current_period_end=now(),cancelled_at=now(),
      billing_terminal_at=now(),cancel_at_period_end=false,updated_at=now()
    where user_id=p_user_id and provider_subscription_id=p_subscription_ref;

  select coalesce(metadata->>'plan','free'),subscription_ref,coalesce(billing_period_end,expires_at)
    into v_restored_plan,v_restored_ref,v_restored_end
    from public.credit_grants
    where user_id=p_user_id and source_type in ('subscription','free_cycle')
      and status='active' and remaining_amount>0
      and starts_at<=now() and (expires_at is null or expires_at>now())
    order by case coalesce(metadata->>'plan','free')
      when 'scale' then 3 when 'growth' then 2 when 'starter' then 1 else 0 end desc,
      starts_at desc,id desc
    limit 1;

  if v_restored_plan in ('starter','growth','scale') and v_restored_ref is not null then
    update public.profiles
      set plan=v_restored_plan,subscription_status='active',subscription_end=v_restored_end,
        current_subscription_ref=v_restored_ref,updated_at=now()
      where id=p_user_id;
  else
    update public.profiles
      set plan='free',subscription_status=p_terminal_status,subscription_end=now(),
        current_subscription_ref=null,updated_at=now()
      where id=p_user_id;
  end if;

  v_remaining:=public.sync_credit_mirror(p_user_id);
  return jsonb_build_object(
    'revoked',v_revoked,'restored',v_restored,'remaining',v_remaining,'replayed',false
  );
end $$;

revoke all on function public.revoke_subscription_transaction_credits(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.revoke_subscription_transaction_credits(
  uuid,text,text,text,text,text
) to service_role;
