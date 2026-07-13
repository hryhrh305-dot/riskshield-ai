-- Deterministic cutover: SECWYN-LEDGER-V1-20260713. Never replace this ID with current_date.
create table if not exists public.credit_ledger_cutover_snapshots(
  user_id uuid primary key references auth.users(id) on delete restrict,
  cutover_id text not null default 'SECWYN-LEDGER-V1-20260713',
  plan text not null,subscription_status text,credits_remaining integer not null,
  entitlement integer not null,anchor_at timestamptz,subscription_ref text,snapshotted_at timestamptz not null default now()
);
create table if not exists public.credit_ledger_backfill_exceptions(
  user_id uuid primary key references auth.users(id) on delete restrict,reason text not null,created_at timestamptz not null default now()
);
alter table public.credit_ledger_cutover_snapshots enable row level security;
alter table public.credit_ledger_backfill_exceptions enable row level security;
revoke all on public.credit_ledger_cutover_snapshots,public.credit_ledger_backfill_exceptions from public,anon,authenticated;
grant select on public.credit_ledger_cutover_snapshots,public.credit_ledger_backfill_exceptions to service_role;

create or replace function public.credit_cycle_boundary(p_anchor timestamptz,p_at timestamptz,p_next boolean)
returns timestamptz language plpgsql immutable set search_path='' as $$
declare a timestamp:=p_anchor at time zone 'UTC'; t timestamp:=p_at at time zone 'UTC';
  v_offset integer; v_month date; v_last integer; v_boundary timestamp;
begin
  v_offset:=(extract(year from t)::integer-extract(year from a)::integer)*12+
    extract(month from t)::integer-extract(month from a)::integer;
  v_month:=(date_trunc('month',a)+make_interval(months=>v_offset))::date;
  v_last:=extract(day from (v_month+interval '1 month - 1 day'))::integer;
  v_boundary:=v_month+(least(extract(day from a)::integer,v_last)-1)*interval '1 day'+(a-date_trunc('day',a));
  if v_boundary>t then v_offset:=v_offset-1; end if;
  if p_next then v_offset:=v_offset+1; end if;
  v_month:=(date_trunc('month',a)+make_interval(months=>v_offset))::date;
  v_last:=extract(day from (v_month+interval '1 month - 1 day'))::integer;
  v_boundary:=v_month+(least(extract(day from a)::integer,v_last)-1)*interval '1 day'+(a-date_trunc('day',a));
  return v_boundary at time zone 'UTC';
end $$;
revoke all on function public.credit_cycle_boundary(timestamptz,timestamptz,boolean) from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.profiles where credits_remaining<0 or credits_remaining is null) then
    raise exception 'INVALID_PROFILE_BALANCE_BEFORE_BACKFILL';
  end if;
  if exists(select 1 from public.credit_grants) and not exists(select 1 from public.credit_ledger_cutover_snapshots) then
    raise exception 'CREDIT_LEDGER_NOT_EMPTY_BEFORE_BACKFILL';
  end if;
end $$;

insert into public.credit_ledger_cutover_snapshots(user_id,plan,subscription_status,credits_remaining,entitlement,anchor_at,subscription_ref)
select profile.id,profile.plan,profile.subscription_status,profile.credits_remaining,
  case
    when profile.plan='free' then 50
    when profile.plan='starter' and subscription.plan=profile.plan and subscription.provider_subscription_id is not null and subscription.credit_anchor_at<=now() then 500
    when profile.plan='growth' and subscription.plan=profile.plan and subscription.provider_subscription_id is not null and subscription.credit_anchor_at<=now() then 2500
    when profile.plan='scale' and subscription.plan=profile.plan and subscription.provider_subscription_id is not null and subscription.credit_anchor_at<=now() then 15000
    else 0 end,
  case when profile.plan='free' then profile.created_at else subscription.credit_anchor_at end,
  case when profile.plan in ('starter','growth','scale') then subscription.provider_subscription_id end
from public.profiles profile
left join lateral (
  select provider_subscription_id,credit_anchor_at,plan from public.subscriptions
  where user_id=profile.id and status in ('active','cancelled')
  order by current_period_start desc nulls last,created_at desc limit 1
) subscription on true
on conflict(user_id) do nothing;

insert into public.credit_ledger_backfill_exceptions(user_id,reason)
select snapshot.user_id,case when snapshot.plan='business' then 'Business balance preserved for manual contract review.'
  when snapshot.plan in ('starter','growth','scale') then 'Paid subscription is missing a provider-confirmed credit anchor.'
  else 'Unknown legacy plan preserved as manual balance.' end
from public.credit_ledger_cutover_snapshots snapshot where snapshot.entitlement=0 and snapshot.plan<>'free'
on conflict(user_id) do nothing;

insert into public.credit_grants(user_id,credit_type,source_type,source_ref,granted_amount,remaining_amount,
  starts_at,expires_at,subscription_ref,billing_period_start,billing_period_end,status,metadata)
select snapshot.user_id,'contact_audit',case when snapshot.plan='free' then 'free_cycle' else 'subscription' end,
  'SECWYN-LEDGER-V1-20260713:cycle:'||snapshot.user_id::text,
  snapshot.entitlement,least(snapshot.credits_remaining,snapshot.entitlement),
  public.credit_cycle_boundary(snapshot.anchor_at,now(),false),public.credit_cycle_boundary(snapshot.anchor_at,now(),true),
  snapshot.subscription_ref,
  case when snapshot.plan<>'free' then public.credit_cycle_boundary(snapshot.anchor_at,now(),false) end,
  case when snapshot.plan<>'free' then public.credit_cycle_boundary(snapshot.anchor_at,now(),true) end,
  case when least(snapshot.credits_remaining,snapshot.entitlement)=0 then 'consumed' else 'active' end,
  jsonb_build_object('cutoverId','SECWYN-LEDGER-V1-20260713','plan',snapshot.plan,'backfilled',true)
from public.credit_ledger_cutover_snapshots snapshot where snapshot.entitlement>0 and snapshot.anchor_at is not null
  and not exists(select 1 from public.credit_grants where user_id=snapshot.user_id)
on conflict (user_id, source_type, source_ref) do nothing;

insert into public.credit_grants(user_id,credit_type,source_type,source_ref,granted_amount,remaining_amount,starts_at,status,metadata)
select snapshot.user_id,'contact_audit','backfill','SECWYN-LEDGER-V1-20260713:manual:'||snapshot.user_id::text,
  greatest(snapshot.credits_remaining-snapshot.entitlement,0),greatest(snapshot.credits_remaining-snapshot.entitlement,0),
  snapshot.snapshotted_at,'active',jsonb_build_object('cutoverId','SECWYN-LEDGER-V1-20260713','plan',snapshot.plan,'balancePreserved',true)
from public.credit_ledger_cutover_snapshots snapshot
where greatest(snapshot.credits_remaining-snapshot.entitlement,0)>0
on conflict (user_id, source_type, source_ref) do nothing;

update public.profiles profile set current_subscription_ref=snapshot.subscription_ref
from public.credit_ledger_cutover_snapshots snapshot
where profile.id=snapshot.user_id and snapshot.subscription_ref is not null;

do $$ begin
  if exists(
    select 1 from public.credit_ledger_cutover_snapshots snapshot
    left join lateral (
      select coalesce(sum(grant_row.remaining_amount),0)::integer total from public.credit_grants grant_row
      where grant_row.user_id=snapshot.user_id and grant_row.credit_type='contact_audit'
        and grant_row.status='active' and grant_row.remaining_amount>0
        and grant_row.starts_at<=now() and (grant_row.expires_at is null or grant_row.expires_at>now())
    ) ledger on true where ledger.total<>snapshot.credits_remaining
  ) then raise exception 'CREDIT_LEDGER_BACKFILL_MISMATCH'; end if;
end $$;
