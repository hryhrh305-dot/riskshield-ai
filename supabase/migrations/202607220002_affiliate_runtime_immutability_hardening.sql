-- Runtime immutability hardening for the isolated Affiliate platform.
-- Additive only. Production application remains a separate HumanOps gate.
begin;

create or replace function public.affiliate_protect_provider_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AFFILIATE_PROVIDER_SALE_IMMUTABLE';
  end if;
  if old.id <> new.id
    or old.program_id <> new.program_id
    or old.attribution_id <> new.attribution_id
    or old.provider <> new.provider
    or old.provider_transaction_id <> new.provider_transaction_id
    or old.canonical_customer_id <> new.canonical_customer_id
    or old.plan <> new.plan
    or old.billing_interval <> new.billing_interval
    or old.currency <> new.currency
    or old.gross_amount_minor <> new.gross_amount_minor
    or old.paid_at <> new.paid_at
    or old.raw_event_ref <> new.raw_event_ref
    or old.created_at <> new.created_at then
    raise exception 'AFFILIATE_PROVIDER_SALE_IMMUTABLE';
  end if;
  if old.status in ('refunded', 'chargeback', 'reversed') and new.status <> old.status then
    raise exception 'AFFILIATE_TERMINAL_SALE_IMMUTABLE';
  end if;
  return new;
end
$$;

drop trigger if exists affiliate_sale_terminal_immutable on public.affiliate_sales;
drop trigger if exists affiliate_provider_sale_immutable on public.affiliate_sales;
create trigger affiliate_provider_sale_immutable
before update or delete on public.affiliate_sales
for each row execute function public.affiliate_protect_provider_sale();

create or replace function public.affiliate_protect_outbox_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AFFILIATE_OUTBOX_APPEND_ONLY';
  end if;
  if old.id <> new.id
    or old.program_id <> new.program_id
    or old.aggregate_type <> new.aggregate_type
    or old.aggregate_id <> new.aggregate_id
    or old.event_type <> new.event_type
    or old.event_version <> new.event_version
    or old.payload <> new.payload
    or old.idempotency_key <> new.idempotency_key
    or old.created_at <> new.created_at then
    raise exception 'AFFILIATE_OUTBOX_EVENT_IMMUTABLE';
  end if;
  return new;
end
$$;

drop trigger if exists affiliate_outbox_event_immutable on public.affiliate_outbox_events;
create trigger affiliate_outbox_event_immutable
before update or delete on public.affiliate_outbox_events
for each row execute function public.affiliate_protect_outbox_event();

drop trigger if exists affiliate_reconciliation_immutable on public.affiliate_reconciliations;
create trigger affiliate_reconciliation_immutable
before update or delete on public.affiliate_reconciliations
for each row execute function public.affiliate_prevent_mutation();

create or replace function public.affiliate_protect_payout_batch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AFFILIATE_PAYOUT_BATCH_IMMUTABLE';
  end if;
  if old.id <> new.id
    or old.program_id <> new.program_id
    or old.period_start <> new.period_start
    or old.period_end <> new.period_end
    or old.currency <> new.currency
    or old.freeze_at <> new.freeze_at
    or old.snapshot_hash <> new.snapshot_hash
    or old.created_at <> new.created_at then
    raise exception 'AFFILIATE_PAYOUT_SNAPSHOT_IMMUTABLE';
  end if;
  if old.status <> 'draft' and old.amount_minor <> new.amount_minor then
    raise exception 'AFFILIATE_PAYOUT_SNAPSHOT_IMMUTABLE';
  end if;
  if old.status in ('paid', 'reconciled', 'cancelled') then
    raise exception 'AFFILIATE_PAYOUT_BATCH_IMMUTABLE';
  end if;
  return new;
end
$$;

drop trigger if exists affiliate_payout_batch_immutable on public.affiliate_payout_batches;
create trigger affiliate_payout_batch_immutable
before update or delete on public.affiliate_payout_batches
for each row execute function public.affiliate_protect_payout_batch();

commit;
