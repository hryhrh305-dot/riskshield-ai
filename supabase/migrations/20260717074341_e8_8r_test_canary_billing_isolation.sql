-- E8.8R Phase C1: fully isolated Creem Test Canary billing evidence.
-- These tables are intentionally separate from the Live payment, subscription,
-- credit-grant and referral ledgers. Existing production records are untouched.

create table if not exists public.test_canary_webhook_events (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null default 'test_canary'
    check (billing_environment = 'test_canary'),
  provider text not null default 'creem' check (provider = 'creem'),
  provider_event_id text not null check (btrim(provider_event_id) <> ''),
  event_type text not null check (btrim(event_type) <> ''),
  payload_hash text not null check (length(payload_hash) = 64),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  provider_checkout_id text,
  provider_transaction_id text,
  provider_subscription_id text,
  correlation_id text not null check (btrim(correlation_id) <> ''),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.test_canary_payments (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null default 'test_canary'
    check (billing_environment = 'test_canary'),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'creem' check (provider = 'creem'),
  provider_checkout_id text not null check (btrim(provider_checkout_id) <> ''),
  provider_transaction_id text,
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  provider_customer_id text,
  provider_subscription_id text,
  correlation_id text not null check (btrim(correlation_id) <> ''),
  catalog_generation text not null default 'premium_v2'
    check (catalog_generation = 'premium_v2'),
  plan text not null check (plan in ('starter','growth','scale')),
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  amount numeric(12,2),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending'
    check (status in ('pending','completed','failed','refunded','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_canary_subscriptions (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null default 'test_canary'
    check (billing_environment = 'test_canary'),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'creem' check (provider = 'creem'),
  provider_subscription_id text not null check (btrim(provider_subscription_id) <> ''),
  provider_customer_id text not null check (btrim(provider_customer_id) <> ''),
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  correlation_id text not null check (btrim(correlation_id) <> ''),
  catalog_generation text not null default 'premium_v2'
    check (catalog_generation = 'premium_v2'),
  plan text not null check (plan in ('starter','growth','scale')),
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  status text not null default 'active'
    check (status in ('active','cancelled','expired','past_due','paused')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);

create table if not exists public.test_canary_credit_grants (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null default 'test_canary'
    check (billing_environment = 'test_canary'),
  user_id uuid not null references auth.users(id) on delete restrict,
  payment_id uuid not null references public.test_canary_payments(id) on delete restrict,
  subscription_id uuid not null references public.test_canary_subscriptions(id) on delete restrict,
  provider_transaction_id text not null check (btrim(provider_transaction_id) <> ''),
  provider_subscription_id text not null check (btrim(provider_subscription_id) <> ''),
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  catalog_generation text not null default 'premium_v2'
    check (catalog_generation = 'premium_v2'),
  plan text not null check (plan in ('starter','growth','scale')),
  granted_amount integer not null check (granted_amount > 0),
  service_month_start timestamptz not null,
  service_month_end timestamptz not null,
  status text not null default 'evidence_only'
    check (status in ('evidence_only','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_month_end > service_month_start)
);

create table if not exists public.test_canary_referral_snapshots (
  id uuid primary key default gen_random_uuid(),
  billing_environment text not null default 'test_canary'
    check (billing_environment = 'test_canary'),
  referred_user_id uuid not null references auth.users(id) on delete restrict,
  payment_id uuid not null references public.test_canary_payments(id) on delete restrict,
  provider_transaction_id text not null check (btrim(provider_transaction_id) <> ''),
  catalog_generation text not null default 'premium_v2'
    check (catalog_generation = 'premium_v2'),
  plan text not null check (plan in ('starter','growth','scale')),
  reward_credits integer not null check (reward_credits in (50,250,1000)),
  synthetic_referrer_ref text not null default 'isolated_test_canary'
    check (synthetic_referrer_ref = 'isolated_test_canary'),
  status text not null default 'planned_only'
    check (status in ('planned_only','disqualified')),
  created_at timestamptz not null default now()
);

create unique index if not exists test_canary_webhook_event_uidx
  on public.test_canary_webhook_events(billing_environment,provider,provider_event_id);
create unique index if not exists test_canary_payment_checkout_uidx
  on public.test_canary_payments(billing_environment,provider,provider_checkout_id);
create unique index if not exists test_canary_payment_transaction_uidx
  on public.test_canary_payments(billing_environment,provider,provider_transaction_id)
  where provider_transaction_id is not null;
create unique index if not exists test_canary_payment_correlation_uidx
  on public.test_canary_payments(billing_environment,correlation_id);
create index if not exists test_canary_payments_user_idx
  on public.test_canary_payments(user_id,created_at desc);
create unique index if not exists test_canary_subscription_provider_uidx
  on public.test_canary_subscriptions(billing_environment,provider,provider_subscription_id);
create index if not exists test_canary_subscriptions_user_status_idx
  on public.test_canary_subscriptions(user_id,status,updated_at desc);
create unique index if not exists test_canary_grant_service_month_uidx
  on public.test_canary_credit_grants(
    billing_environment,provider_subscription_id,service_month_start
  );
create index if not exists test_canary_grants_user_idx
  on public.test_canary_credit_grants(user_id,service_month_start desc);
create unique index if not exists test_canary_referral_payment_uidx
  on public.test_canary_referral_snapshots(billing_environment,payment_id);

alter table public.test_canary_webhook_events enable row level security;
alter table public.test_canary_payments enable row level security;
alter table public.test_canary_subscriptions enable row level security;
alter table public.test_canary_credit_grants enable row level security;
alter table public.test_canary_referral_snapshots enable row level security;

revoke all on public.test_canary_webhook_events from public,anon,authenticated;
revoke all on public.test_canary_payments from public,anon,authenticated;
revoke all on public.test_canary_subscriptions from public,anon,authenticated;
revoke all on public.test_canary_credit_grants from public,anon,authenticated;
revoke all on public.test_canary_referral_snapshots from public,anon,authenticated;

grant select,insert,update on public.test_canary_webhook_events to service_role;
grant select,insert,update on public.test_canary_payments to service_role;
grant select,insert,update on public.test_canary_subscriptions to service_role;
grant select,insert,update on public.test_canary_credit_grants to service_role;
grant select,insert,update on public.test_canary_referral_snapshots to service_role;

create or replace function public.process_test_canary_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_user_id uuid,
  p_checkout_id text,
  p_transaction_id text,
  p_subscription_id text,
  p_customer_id text,
  p_product_id text,
  p_correlation_id text,
  p_plan text,
  p_billing_interval text,
  p_amount numeric,
  p_currency text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_monthly_credits integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_row public.test_canary_webhook_events;
  v_existing_event public.test_canary_webhook_events;
  v_payment public.test_canary_payments;
  v_subscription public.test_canary_subscriptions;
  v_service_month_end timestamptz;
  v_referral_credits integer;
  v_grant_inserted integer := 0;
begin
  if p_event_id is null or btrim(p_event_id) = ''
    or p_event_type not in (
      'checkout.completed','subscription.active','subscription.paid','subscription.update',
      'subscription.canceled','subscription.scheduled_cancel','subscription.past_due',
      'subscription.paused','subscription.expired','refund.created','dispute.created'
    )
    or p_payload_hash is null or length(p_payload_hash) <> 64
    or p_user_id is null
    or p_product_id is null or btrim(p_product_id) = ''
    or p_correlation_id is null or btrim(p_correlation_id) = ''
    or p_plan not in ('starter','growth','scale')
    or p_billing_interval not in ('monthly','yearly')
  then raise exception 'INVALID_TEST_CANARY_WEBHOOK_CONTEXT'; end if;

  perform pg_advisory_xact_lock(hashtextextended('test_canary:' || p_event_id, 0));

  insert into public.test_canary_webhook_events(
    provider_event_id,event_type,payload_hash,user_id,provider_product_id,
    provider_checkout_id,provider_transaction_id,provider_subscription_id,correlation_id
  ) values (
    p_event_id,p_event_type,p_payload_hash,p_user_id,p_product_id,
    p_checkout_id,p_transaction_id,p_subscription_id,p_correlation_id
  )
  on conflict (billing_environment,provider,provider_event_id) do nothing
  returning * into v_event_row;

  if v_event_row.id is null then
    select * into v_existing_event
      from public.test_canary_webhook_events
      where billing_environment='test_canary' and provider='creem' and provider_event_id=p_event_id
      for update;
    if v_existing_event.payload_hash is distinct from p_payload_hash then
      raise exception 'TEST_CANARY_EVENT_ID_PAYLOAD_CONFLICT';
    end if;
    return jsonb_build_object('replayed',true,'granted',0,'billingEnvironment','test_canary');
  end if;

  if p_event_type = 'checkout.completed' then
    if p_checkout_id is null or btrim(p_checkout_id) = '' then
      raise exception 'TEST_CANARY_CHECKOUT_ID_REQUIRED';
    end if;
    update public.test_canary_payments
      set status='completed',updated_at=now()
      where billing_environment='test_canary' and provider='creem'
        and provider_checkout_id=p_checkout_id and user_id=p_user_id
        and provider_product_id=p_product_id and correlation_id=p_correlation_id
      returning * into v_payment;
    if v_payment.id is null then raise exception 'TEST_CANARY_PENDING_PAYMENT_REQUIRED'; end if;
  elsif p_event_type = 'subscription.paid' then
    if p_transaction_id is null or btrim(p_transaction_id) = ''
      or p_subscription_id is null or btrim(p_subscription_id) = ''
      or p_customer_id is null or btrim(p_customer_id) = ''
      or p_period_start is null or p_period_end is null or p_period_end <= p_period_start
      or p_amount is null or p_amount < 0 or p_currency <> 'USD'
      or p_monthly_credits <= 0
    then raise exception 'INVALID_TEST_CANARY_PAID_EVENT'; end if;

    update public.test_canary_payments
      set provider_transaction_id=p_transaction_id,provider_customer_id=p_customer_id,
        provider_subscription_id=p_subscription_id,amount=p_amount,currency=p_currency,
        status='completed',updated_at=now()
      where billing_environment='test_canary' and correlation_id=p_correlation_id
        and user_id=p_user_id and provider_product_id=p_product_id
        and plan=p_plan and billing_interval=p_billing_interval
      returning * into v_payment;
    if v_payment.id is null then raise exception 'TEST_CANARY_PENDING_PAYMENT_REQUIRED'; end if;

    insert into public.test_canary_subscriptions(
      user_id,provider_subscription_id,provider_customer_id,provider_product_id,
      correlation_id,plan,billing_interval,status,current_period_start,current_period_end
    ) values (
      p_user_id,p_subscription_id,p_customer_id,p_product_id,
      p_correlation_id,p_plan,p_billing_interval,'active',p_period_start,p_period_end
    )
    on conflict (billing_environment,provider,provider_subscription_id) do update set
      provider_customer_id=excluded.provider_customer_id,
      provider_product_id=excluded.provider_product_id,
      correlation_id=excluded.correlation_id,
      plan=excluded.plan,
      billing_interval=excluded.billing_interval,
      status='active',
      current_period_start=excluded.current_period_start,
      current_period_end=excluded.current_period_end,
      updated_at=now()
    where public.test_canary_subscriptions.user_id=excluded.user_id
      and public.test_canary_subscriptions.provider_product_id=excluded.provider_product_id
    returning * into v_subscription;
    if v_subscription.id is null then raise exception 'TEST_CANARY_SUBSCRIPTION_CONFLICT'; end if;

    v_service_month_end := case when p_billing_interval='yearly'
      then least(p_period_end,p_period_start + interval '1 month') else p_period_end end;
    insert into public.test_canary_credit_grants(
      user_id,payment_id,subscription_id,provider_transaction_id,provider_subscription_id,
      provider_product_id,plan,granted_amount,service_month_start,service_month_end
    ) values (
      p_user_id,v_payment.id,v_subscription.id,p_transaction_id,p_subscription_id,
      p_product_id,p_plan,p_monthly_credits,p_period_start,v_service_month_end
    )
    on conflict (billing_environment,provider_subscription_id,service_month_start) do nothing;
    get diagnostics v_grant_inserted = row_count;

    if v_grant_inserted = 0 and not exists (
      select 1 from public.test_canary_credit_grants
      where billing_environment='test_canary' and provider_subscription_id=p_subscription_id
        and service_month_start=p_period_start and user_id=p_user_id
        and provider_transaction_id=p_transaction_id and provider_product_id=p_product_id
        and granted_amount=p_monthly_credits
    ) then raise exception 'TEST_CANARY_GRANT_CONFLICT'; end if;

    v_referral_credits := case p_plan when 'starter' then 50 when 'growth' then 250 else 1000 end;
    insert into public.test_canary_referral_snapshots(
      referred_user_id,payment_id,provider_transaction_id,plan,reward_credits
    ) values (p_user_id,v_payment.id,p_transaction_id,p_plan,v_referral_credits)
    on conflict (billing_environment,payment_id) do nothing;
  end if;

  update public.test_canary_webhook_events set processed_at=now() where id=v_event_row.id;
  return jsonb_build_object(
    'replayed',false,'granted',v_grant_inserted,
    'billingEnvironment','test_canary'
  );
end;
$$;

revoke all on function public.process_test_canary_webhook_event(
  text,text,text,uuid,text,text,text,text,text,text,text,text,numeric,text,timestamptz,timestamptz,integer
) from public,anon,authenticated;
grant execute on function public.process_test_canary_webhook_event(
  text,text,text,uuid,text,text,text,text,text,text,text,text,numeric,text,timestamptz,timestamptz,integer
) to service_role;
