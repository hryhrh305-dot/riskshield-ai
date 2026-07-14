-- Secwyn E8: additive, service-role-only observability backbone.
-- No existing table, trigger, RPC, credit, referral, auth, or risk logic is changed.

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  list_tier text, template_key text, step_key text, country_code text,
  market text, source_keyword text, budget numeric(14,2) check (budget is null or budget >= 0),
  daily_send_limit integer check (daily_send_limit is null or daily_send_limit >= 0), template_version text,
  starts_at timestamptz, ends_at timestamptz, feature_flag_key text,
  provider text not null default 'ses', source text not null default 'internal',
  idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  safety_paused_at timestamptz, safety_pause_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, idempotency_key)
);

create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(), campaign_id uuid references public.outreach_campaigns(id) on delete cascade,
  identity_hash text not null, company_domain text, company_name text, contact_name text, title text,
  country_code text, source_keyword text, source_url text, list_tier text, risk_score integer, decision text,
  collected_at timestamptz, contacted_at timestamptz, suppression_status text, provider text,
  source text not null default 'internal', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, idempotency_key), unique (campaign_id, identity_hash)
);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(), campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null, provider text not null default 'ses', provider_message_id text,
  ses_configuration_set text, template_key text, template_version text, step_key text,
  market text, source_keyword text, batch_id text, list_tier text, country_code text, status text not null default 'queued',
  source text not null default 'internal', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, idempotency_key), unique (provider, provider_message_id)
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(), campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null, provider text not null default 'ses',
  provider_message_id text, provider_event_id text,
  event_type text not null check (event_type in ('send','delivery','hard_bounce','soft_bounce','complaint','reject','delivery_delay','open','click','unsubscribe','rendering_failure','unknown')),
  identity_hash text,
  recipient_domain text, bounce_type text, bounce_subtype text, complaint_type text, batch_id text,
  market text, source_keyword text, template_key text, step_key text, list_tier text, country_code text,
  occurred_at timestamptz not null, received_at timestamptz not null default now(), raw_payload jsonb not null,
  payload_hash text not null, raw_payload_expires_at timestamptz not null default (now() + interval '90 days'),
  source text not null default 'aws_sns', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  unique (source, idempotency_key)
);

create table if not exists public.acquisition_attribution (
  id uuid primary key default gen_random_uuid(), anonymous_id uuid not null, user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null, cid_jti text,
  first_utm_source text, first_utm_medium text, first_utm_campaign text, first_utm_content text, first_utm_term text,
  last_non_direct_source text, last_non_direct_medium text, last_non_direct_campaign text,
  assisted_channels text[] not null default '{}'::text[], registered_at timestamptz, attribution_version integer not null default 1,
  landing_path text, source text not null default 'web', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, idempotency_key), unique (anonymous_id)
);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(), attribution_id uuid references public.acquisition_attribution(id) on delete set null,
  anonymous_id uuid, user_id uuid references auth.users(id) on delete set null, event_name text not null,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null,
  template_key text, step_key text, list_tier text, utm_source text, utm_medium text, utm_campaign text,
  country_code text, source_keyword text, provider text,
  path text, properties jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  source text not null default 'web', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  created_at timestamptz not null default now(), unique (source, idempotency_key)
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  attribution_id uuid references public.acquisition_attribution(id) on delete set null, provider text not null,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  referral_attribution_id uuid,
  provider_event_id text, provider_event_type text not null, event_type text not null, provider_checkout_id text, provider_payment_id text,
  provider_subscription_id text, provider_customer_id text, outreach_message_id text,
  plan text, billing_interval text, currency text, gross_amount numeric(14,2), fee_amount numeric(14,2),
  refund_amount numeric(14,2), net_amount numeric(14,2), referral_amount numeric(14,2),
  template_key text, step_key text, list_tier text, country_code text, source_keyword text, market text,
  matched boolean not null default false, occurred_at timestamptz, received_at timestamptz not null default now(),
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','matched','unmatched','needs_review','reconciled')),
  raw_payload jsonb not null,
  raw_payload_expires_at timestamptz not null default (now() + interval '90 days'),
  source text not null default 'creem', idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  created_at timestamptz not null default now(), unique (source, idempotency_key)
);

create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(), identity_hash text not null,
  reason text not null check (reason in ('hard_bounce','complaint','unsubscribe','manual','provider_rejection','explicit_rejection')),
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  provider text, provider_message_id text, provider_sync_id text, sync_status text not null default 'pending',
  template_key text, step_key text, list_tier text, country_code text, source_keyword text,
  last_synced_at timestamptz, scope text not null default 'marketing' check (scope in ('marketing','campaign','global_marketing')),
  permanent boolean not null default true,
  suppressed_at timestamptz not null default now(),
  source text not null, idempotency_key text not null check (btrim(idempotency_key) <> ''), schema_version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, idempotency_key), unique (identity_hash, reason)
);

create index if not exists idx_e8_campaign_status on public.outreach_campaigns(status, created_at desc);
create index if not exists idx_e8_prospect_campaign on public.outreach_prospects(campaign_id);
create index if not exists idx_e8_message_campaign on public.outreach_messages(campaign_id, sent_at desc);
create index if not exists idx_e8_message_prospect on public.outreach_messages(prospect_id);
create index if not exists idx_e8_email_event_campaign on public.email_events(campaign_id, occurred_at desc);
create index if not exists idx_e8_email_event_type on public.email_events(event_type, occurred_at desc);
create unique index if not exists idx_e8_email_provider_event on public.email_events(provider, provider_event_id);
create index if not exists idx_e8_email_message on public.email_events(message_id);
create index if not exists idx_e8_email_prospect on public.email_events(prospect_id);
create index if not exists idx_e8_email_batch on public.email_events(batch_id, event_type);
create index if not exists idx_e8_attribution_user on public.acquisition_attribution(user_id);
create index if not exists idx_e8_attribution_campaign on public.acquisition_attribution(campaign_id);
create index if not exists idx_e8_attribution_prospect on public.acquisition_attribution(prospect_id);
create index if not exists idx_e8_attribution_message on public.acquisition_attribution(message_id);
create index if not exists idx_e8_product_event_name on public.product_events(event_name, occurred_at desc);
create index if not exists idx_e8_product_campaign on public.product_events(campaign_id, occurred_at desc);
create index if not exists idx_e8_product_attribution on public.product_events(attribution_id);
create index if not exists idx_e8_product_user on public.product_events(user_id);
create index if not exists idx_e8_product_prospect on public.product_events(prospect_id);
create index if not exists idx_e8_product_message on public.product_events(message_id);
create index if not exists idx_e8_subscription_event_type on public.subscription_events(event_type, received_at desc);
create unique index if not exists idx_e8_subscription_provider_event on public.subscription_events(provider, provider_event_id) where provider_event_id is not null;
create index if not exists idx_e8_subscription_campaign on public.subscription_events(campaign_id, received_at desc);
create index if not exists idx_e8_subscription_message on public.subscription_events(message_id);
create index if not exists idx_e8_subscription_prospect on public.subscription_events(prospect_id);
create index if not exists idx_e8_subscription_user on public.subscription_events(user_id);
create index if not exists idx_e8_subscription_attribution on public.subscription_events(attribution_id);
create index if not exists idx_e8_subscription_referral on public.subscription_events(referral_attribution_id);
create index if not exists idx_e8_email_raw_expiry on public.email_events(raw_payload_expires_at);
create index if not exists idx_e8_subscription_raw_expiry on public.subscription_events(raw_payload_expires_at);
create index if not exists idx_e8_suppression_identity on public.suppression_list(identity_hash) where permanent = true;
create index if not exists idx_e8_suppression_campaign on public.suppression_list(campaign_id);

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_prospects enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.email_events enable row level security;
alter table public.acquisition_attribution enable row level security;
alter table public.product_events enable row level security;
alter table public.subscription_events enable row level security;
alter table public.suppression_list enable row level security;

revoke all on public.outreach_campaigns, public.outreach_prospects, public.outreach_messages,
  public.email_events, public.acquisition_attribution, public.product_events,
  public.subscription_events, public.suppression_list from public, anon, authenticated, service_role;
grant select, insert, update on public.outreach_campaigns to service_role;
grant select, insert, update on public.outreach_prospects to service_role;
grant select, insert, update on public.outreach_messages to service_role;
grant select, insert on public.email_events to service_role;
grant select, insert, update on public.acquisition_attribution to service_role;
grant select, insert on public.product_events to service_role;
grant select, insert on public.subscription_events to service_role;
grant select, insert, update on public.suppression_list to service_role;

create or replace function public.purge_e8_expired_raw_payloads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  changed integer := 0;
begin
  update public.email_events set raw_payload = '{}'::jsonb
    where raw_payload_expires_at <= now() and raw_payload <> '{}'::jsonb;
  get diagnostics changed = row_count;
  affected := affected + changed;
  update public.subscription_events set raw_payload = '{}'::jsonb
    where raw_payload_expires_at <= now() and raw_payload <> '{}'::jsonb;
  get diagnostics changed = row_count;
  return affected + changed;
end;
$$;
revoke all on function public.purge_e8_expired_raw_payloads() from public, anon, authenticated;
grant execute on function public.purge_e8_expired_raw_payloads() to service_role;
