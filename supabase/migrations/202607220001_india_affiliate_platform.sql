-- Secwyn India Affiliate platform. Additive only; do not apply to Production without HumanOps approval.
begin;

create extension if not exists pgcrypto;

create table if not exists public.affiliate_programs (
  id text primary key, name text not null, country_code text not null, timezone text not null default 'Asia/Kolkata',
  status text not null check(status in ('draft','shadow','active','paused','retired')), launch_start_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_rule_versions (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), version integer not null,
  status text not null check(status in ('draft','approved','published','retired')), effective_from timestamptz not null,
  effective_until timestamptz, rules jsonb not null, checksum text not null, approved_by uuid, approved_at timestamptz,
  created_at timestamptz not null default now(), unique(program_id,version), unique(program_id,checksum)
);
create table if not exists public.affiliate_program_capabilities (
  program_id text not null references public.affiliate_programs(id), rule_version_id uuid not null references public.affiliate_rule_versions(id),
  capability text not null, enabled boolean not null, created_at timestamptz not null default now(), primary key(program_id,rule_version_id,capability)
);
create table if not exists public.affiliate_program_channels (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), channel_code text not null,
  status text not null check(status in ('draft','active','paused','retired')), configuration jsonb not null default '{}', created_at timestamptz not null default now(), unique(program_id,channel_code)
);
create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), user_id uuid not null,
  country_code text not null, source text, channel_code text, answers jsonb not null default '{}', status text not null default 'submitted',
  review_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(program_id,user_id)
);
create table if not exists public.affiliate_memberships (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), user_id uuid not null,
  affiliate_code text not null, status text not null check(status in ('provisional','approved','suspended','terminated')),
  provisional_started_at timestamptz, provisional_ends_at timestamptz, grace_used_at timestamptz, approved_at timestamptz, first_paid_at timestamptz,
  expires_no_sale_at timestamptz, privacy_consent boolean not null default false,
  public_alias text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(program_id,user_id), unique(program_id,affiliate_code)
);
create table if not exists public.affiliate_operator_roles (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), user_id uuid not null,
  role text not null check(role in ('content_editor','compliance_reviewer','program_manager','publisher','affiliate_admin','super_admin')),
  granted_by uuid, created_at timestamptz not null default now(), revoked_at timestamptz,
  unique(program_id,user_id,role)
);
create table if not exists public.affiliate_profiles (
  membership_id uuid primary key references public.affiliate_memberships(id), display_name text, country_code text not null check(country_code='IN'),
  timezone text not null default 'Asia/Kolkata', preferred_locale text not null default 'en', profile_data jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.affiliate_policy_acceptances (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.affiliate_applications(id), policy_version text not null,
  accepted_at timestamptz not null, ip_hash text, user_agent_hash text, created_at timestamptz not null default now(), unique(application_id,policy_version)
);
create table if not exists public.affiliate_quiz_attempts (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.affiliate_applications(id), quiz_version text not null,
  answers jsonb not null, score integer not null check(score between 0 and 5), passed boolean not null, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_activation_actions (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.affiliate_memberships(id), action_type text not null,
  format text not null, occurred_at timestamptz not null, evidence jsonb not null default '{}', idempotency_key text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_activation_events (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.affiliate_memberships(id), event_type text not null,
  format text, occurred_at timestamptz not null, evidence jsonb not null default '{}', idempotency_key text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), affiliate_id uuid not null references public.affiliate_memberships(id),
  canonical_customer_id text not null, generation integer not null default 1 check(generation=1), click_at timestamptz not null, registered_at timestamptz,
  expires_at timestamptz not null, locked_at timestamptz, source text, channel_code text, fingerprint text not null,
  created_at timestamptz not null default now(), unique(program_id,canonical_customer_id), unique(program_id,fingerprint)
);
create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), affiliate_id uuid not null references public.affiliate_memberships(id),
  code text not null, source text, channel_code text, status text not null default 'active', created_at timestamptz not null default now(), unique(program_id,code)
);
create table if not exists public.affiliate_click_events (
  id uuid primary key default gen_random_uuid(), link_id uuid not null references public.affiliate_links(id), clicked_at timestamptz not null,
  request_fingerprint text not null, ip_hash text, user_agent_hash text, created_at timestamptz not null default now(), unique(link_id,request_fingerprint)
);
create table if not exists public.affiliate_customer_identity_links (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), canonical_customer_id text not null,
  identity_type text not null, identity_hash text not null, verified_at timestamptz, created_at timestamptz not null default now(), unique(program_id,identity_type,identity_hash)
);
create table if not exists public.affiliate_attribution_adjustments (
  id uuid primary key default gen_random_uuid(), attribution_id uuid not null references public.affiliate_attributions(id), requested_by uuid not null,
  reason text not null, evidence jsonb not null, outcome text not null check(outcome in ('approved','rejected')), created_at timestamptz not null default now()
);
create table if not exists public.affiliate_referral_relationships (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), inviter_id uuid not null references public.affiliate_memberships(id),
  invitee_id uuid not null references public.affiliate_memberships(id), relationship_depth integer not null default 1 check(relationship_depth=1),
  created_at timestamptz not null default now(), unique(program_id,invitee_id), check(inviter_id<>invitee_id)
);
create table if not exists public.affiliate_sales (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), attribution_id uuid not null references public.affiliate_attributions(id),
  provider text not null, provider_transaction_id text not null, canonical_customer_id text not null, plan text not null, billing_interval text not null,
  currency text not null check(currency='USD'), gross_amount_minor bigint not null check(gross_amount_minor>=0), paid_at timestamptz not null,
  status text not null check(status in ('pending','qualified','refunded','chargeback','reversed')), raw_event_ref text not null,
  created_at timestamptz not null default now(), unique(program_id,provider,provider_transaction_id)
);
create table if not exists public.affiliate_commission_decisions (
  id uuid primary key, program_id text not null references public.affiliate_programs(id), sale_id uuid not null references public.affiliate_sales(id),
  affiliate_id uuid not null references public.affiliate_memberships(id), rule_version_id uuid not null references public.affiliate_rule_versions(id),
  currency text not null check(currency='USD'), amount_minor bigint not null check(amount_minor>=0), status text not null,
  reason text not null, schedule jsonb not null, fingerprint text not null, calculator_version text not null,
  created_at timestamptz not null default now(), unique(program_id,sale_id), unique(program_id,fingerprint)
);
create table if not exists public.affiliate_commission_audits (
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.affiliate_commission_decisions(id),
  calculator_version text not null, expected_amount_minor bigint not null, expected_schedule jsonb not null, matched boolean not null,
  difference jsonb not null default '{}', created_at timestamptz not null default now(), unique(decision_id,calculator_version)
);
create table if not exists public.affiliate_commission_schedules (
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.affiliate_commission_decisions(id), installment integer not null,
  release_at timestamptz not null, amount_minor bigint not null check(amount_minor>=0), status text not null check(status in ('shadow','held','payable','released','reversed')),
  created_at timestamptz not null default now(), unique(decision_id,installment)
);
create table if not exists public.affiliate_commission_adjustments (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), decision_id uuid references public.affiliate_commission_decisions(id),
  amount_minor bigint not null, reason text not null, evidence jsonb not null, requested_by uuid not null, approved_by uuid,
  status text not null check(status in ('requested','approved','rejected','posted')), created_at timestamptz not null default now()
);
create table if not exists public.affiliate_integrity_incidents (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), severity text not null check(severity in ('low','medium','high','critical')),
  incident_type text not null, object_ref text, status text not null check(status in ('open','contained','resolved','false_positive')),
  evidence jsonb not null, opened_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.affiliate_ledger_entries (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), affiliate_id uuid not null references public.affiliate_memberships(id),
  decision_id uuid references public.affiliate_commission_decisions(id), entry_type text not null check(entry_type in ('commission','reserve_release','clawback','adjustment','payout','reversal')),
  currency text not null check(currency='USD'), amount_minor bigint not null, effective_at timestamptz not null,
  posting_state text not null check(posting_state in ('shadow','held','payable','paid','reversed')), idempotency_key text not null,
  correlation_id text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now(), unique(program_id,idempotency_key)
);
create table if not exists public.affiliate_payout_accounts (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.affiliate_memberships(id), provider text not null,
  provider_account_ref text not null, status text not null, verified_at timestamptz, encrypted_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(membership_id,provider)
);
create table if not exists public.affiliate_payout_batches (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), period_start date not null, period_end date not null,
  currency text not null check(currency='USD'), amount_minor bigint not null default 0, status text not null check(status in ('draft','frozen','approved','paid','reconciled','failed','cancelled')),
  freeze_at timestamptz not null, approved_by uuid, approved_at timestamptz, paid_at timestamptz, reconciled_at timestamptz,
  snapshot_hash text not null, created_at timestamptz not null default now(), unique(program_id,period_start,period_end)
);
create table if not exists public.affiliate_payout_items (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.affiliate_payout_batches(id), affiliate_id uuid not null references public.affiliate_memberships(id),
  amount_minor bigint not null check(amount_minor>=0), status text not null, provider_transfer_ref text, idempotency_key text not null unique,
  created_at timestamptz not null default now(), unique(batch_id,affiliate_id)
);
create table if not exists public.affiliate_payout_security (
  membership_id uuid primary key references public.affiliate_memberships(id), pin_hash text, otp_verified_at timestamptz, reauthenticated_at timestamptz,
  payout_account_changed_at timestamptz, failed_attempts integer not null default 0, locked_until timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.affiliate_payout_attempts (
  id uuid primary key default gen_random_uuid(), payout_item_id uuid not null references public.affiliate_payout_items(id), provider text not null,
  provider_attempt_ref text, status text not null, evidence jsonb not null default '{}', idempotency_key text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_reconciliations (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), reconciliation_date date not null,
  source_count bigint not null, decision_count bigint not null, ledger_amount_minor bigint not null, payout_amount_minor bigint not null,
  status text not null check(status in ('matched','mismatch','blocked')), evidence jsonb not null, created_at timestamptz not null default now(), unique(program_id,reconciliation_date)
);
create table if not exists public.affiliate_teams (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), leader_id uuid not null references public.affiliate_memberships(id),
  name text not null, status text not null default 'active', created_at timestamptz not null default now(), unique(program_id,leader_id)
);
create table if not exists public.affiliate_team_members (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.affiliate_teams(id), membership_id uuid not null references public.affiliate_memberships(id),
  joined_at timestamptz not null default now(), left_at timestamptz, unique(team_id,membership_id)
);
create table if not exists public.affiliate_team_months (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.affiliate_teams(id), performance_month date not null,
  qualified_sales_minor bigint not null default 0, leader_personal_independent_orders integer not null default 0, snapshot_hash text not null,
  created_at timestamptz not null default now(), unique(team_id,performance_month)
);
create table if not exists public.affiliate_team_reward_decisions (
  id uuid primary key default gen_random_uuid(), team_month_id uuid not null references public.affiliate_team_months(id), leader_id uuid not null references public.affiliate_memberships(id),
  rule_version_id uuid not null references public.affiliate_rule_versions(id), reward_type text not null, amount_minor bigint not null check(amount_minor>=0),
  fingerprint text not null, created_at timestamptz not null default now(), unique(team_month_id,reward_type), unique(fingerprint)
);
create table if not exists public.affiliate_compliance_cases (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), membership_id uuid references public.affiliate_memberships(id),
  case_type text not null, severity text not null, status text not null, evidence jsonb not null default '{}', created_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.affiliate_policy_violations (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.affiliate_compliance_cases(id), policy_version text not null,
  violation_code text not null, action text not null, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_stop_contact_hashes (
  program_id text not null references public.affiliate_programs(id), contact_hash text not null, source text not null, created_at timestamptz not null default now(), primary key(program_id,contact_hash)
);
create table if not exists public.affiliate_content_items (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), content_key text not null, content_type text not null,
  locale text not null default 'en', created_at timestamptz not null default now(), unique(program_id,content_key,locale)
);
create table if not exists public.affiliate_content_versions (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.affiliate_content_items(id), version integer not null,
  status text not null check(status in ('draft','in_review','approved','scheduled','published','retired','rolled_back')),
  body jsonb not null, variables jsonb not null default '[]', checksum text not null, publish_at timestamptz, published_at timestamptz,
  approved_by uuid, approved_at timestamptz, rollback_of uuid references public.affiliate_content_versions(id), created_by uuid,
  created_at timestamptz not null default now(), unique(content_id,version), unique(content_id,checksum)
);
create table if not exists public.affiliate_content_impacts (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id),
  rule_version_ids uuid[] not null default '{}', requires_rule_review boolean not null, requires_telegram_sync boolean not null,
  status text not null default 'open', reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_content_blocks (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), position integer not null,
  block_type text not null, body jsonb not null, created_at timestamptz not null default now(), unique(content_version_id,position)
);
create table if not exists public.affiliate_content_approvals (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), role text not null,
  reviewer_id uuid not null, decision text not null check(decision in ('approved','rejected')), reason text, created_at timestamptz not null default now(), unique(content_version_id,role)
);
create table if not exists public.affiliate_content_publications (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), target text not null,
  published_at timestamptz, deprecated_at timestamptz, idempotency_key text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_content_localizations (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), locale text not null,
  body jsonb not null, checksum text not null, created_at timestamptz not null default now(), unique(content_version_id,locale)
);
create table if not exists public.affiliate_content_usage_events (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), event_type text not null,
  actor_hash text, context jsonb not null default '{}', occurred_at timestamptz not null default now()
);
create table if not exists public.affiliate_content_sync_targets (
  id uuid primary key default gen_random_uuid(), content_version_id uuid not null references public.affiliate_content_versions(id), target text not null,
  status text not null, last_synced_at timestamptz, created_at timestamptz not null default now(), unique(content_version_id,target)
);
create table if not exists public.affiliate_content_assets (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), asset_key text not null,
  storage_path text not null, mime_type text not null, checksum text not null, status text not null default 'approved', created_at timestamptz not null default now(),
  unique(program_id,asset_key), unique(program_id,checksum)
);
create table if not exists public.affiliate_telegram_channels (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), channel_code text not null,
  public_handle text, external_chat_ref text, verified boolean not null default false, paused boolean not null default true,
  message_limit_daily integer not null default 1, created_at timestamptz not null default now(), unique(program_id,channel_code)
);
create table if not exists public.affiliate_telegram_publications (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.affiliate_telegram_channels(id), content_version_id uuid references public.affiliate_content_versions(id),
  publication_type text not null, subject_ref text, scheduled_at timestamptz not null default now(), local_publication_date date,
  status text not null default 'pending', attempt_count integer not null default 0, locked_at timestamptz, locked_by text,
  external_message_ref text, idempotency_key text not null unique, last_error text, created_at timestamptz not null default now(),
  check(publication_type<>'daily_content' or local_publication_date is not null)
);
create table if not exists public.affiliate_telegram_schedules (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.affiliate_telegram_channels(id), timezone text not null default 'Asia/Kolkata',
  local_time time not null default '12:30', enabled boolean not null default false, created_at timestamptz not null default now(), unique(channel_id)
);
create table if not exists public.affiliate_telegram_event_rules (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.affiliate_telegram_channels(id), event_type text not null,
  enabled boolean not null default false, content_key text, created_at timestamptz not null default now(), unique(channel_id,event_type)
);
create table if not exists public.affiliate_telegram_publication_jobs (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.affiliate_telegram_publications(id), status text not null,
  available_at timestamptz not null default now(), locked_at timestamptz, locked_by text, attempt_count integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.affiliate_telegram_failures (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.affiliate_telegram_publications(id), failure_class text not null,
  safe_error text not null, retryable boolean not null, created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.affiliate_telegram_win_consents (
  membership_id uuid primary key references public.affiliate_memberships(id), consent boolean not null default false, display_mode text not null default 'anonymous',
  approved_alias text, updated_at timestamptz not null default now()
);
create table if not exists public.affiliate_telegram_message_slots (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.affiliate_telegram_channels(id), slot integer not null check(slot between 1 and 7),
  content_version_id uuid references public.affiliate_content_versions(id), pinned boolean not null default false,
  published boolean not null default false, external_message_ref text, external_message_url text,
  replacement_required boolean not null default false,
  status text not null default 'pending_sync', unique(channel_id,slot)
);
create table if not exists public.affiliate_outbox_events (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.affiliate_programs(id), aggregate_type text not null, aggregate_id text not null,
  event_type text not null, event_version integer not null default 1, payload jsonb not null, idempotency_key text not null,
  status text not null default 'pending', available_at timestamptz not null default now(), attempt_count integer not null default 0,
  locked_at timestamptz, locked_by text, processed_at timestamptz, created_at timestamptz not null default now(), unique(program_id,idempotency_key)
);
create table if not exists public.affiliate_dead_letters (
  id uuid primary key default gen_random_uuid(), outbox_event_id uuid not null references public.affiliate_outbox_events(id),
  reason text not null, payload jsonb not null, failed_at timestamptz not null default now(), resolved_at timestamptz, resolution text,
  unique(outbox_event_id)
);
create table if not exists public.affiliate_idempotency_keys (
  namespace text not null, key text not null, request_hash text not null, response jsonb, status text not null default 'processing',
  expires_at timestamptz not null, created_at timestamptz not null default now(), primary key(namespace,key)
);
create table if not exists public.affiliate_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, object_type text not null, object_id text not null,
  reason text, before_state jsonb, after_state jsonb, correlation_id text not null, created_at timestamptz not null default now()
);

create index if not exists affiliate_outbox_claim_idx on public.affiliate_outbox_events(status,available_at) where status='pending';
create index if not exists affiliate_ledger_balance_idx on public.affiliate_ledger_entries(program_id,affiliate_id,effective_at);
create index if not exists affiliate_content_publish_idx on public.affiliate_content_versions(status,publish_at);
create index if not exists affiliate_sales_customer_idx on public.affiliate_sales(program_id,canonical_customer_id,paid_at);
create unique index if not exists affiliate_sales_first_customer_uidx on public.affiliate_sales(program_id,canonical_customer_id);
create unique index if not exists affiliate_telegram_daily_uidx on public.affiliate_telegram_publications(channel_id,local_publication_date)
  where publication_type='daily_content';

-- Every single-column Affiliate foreign key receives a supporting index before runtime traffic.
do $$ declare item record; begin
  for item in
    select rel.relname as table_name, att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace nsp on nsp.oid=rel.relnamespace
    join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1]
    where con.contype='f' and nsp.nspname='public' and rel.relname like 'affiliate\_%' escape E'\\'
      and array_length(con.conkey,1)=1
  loop
    execute format('create index if not exists %I on public.%I (%I)',
      left(item.table_name||'_'||item.column_name||'_fkey_idx',63),item.table_name,item.column_name);
  end loop;
end $$;

create or replace function public.affiliate_prevent_mutation() returns trigger language plpgsql as $$ begin raise exception 'AFFILIATE_IMMUTABLE'; end $$;
create or replace function public.affiliate_prevent_delete() returns trigger language plpgsql as $$ begin raise exception 'AFFILIATE_APPEND_ONLY'; end $$;
create or replace function public.affiliate_protect_terminal_sale() returns trigger language plpgsql as $$ begin if old.status in ('refunded','chargeback','reversed') and new.status<>old.status then raise exception 'AFFILIATE_TERMINAL_SALE_IMMUTABLE'; end if; return new; end $$;
drop trigger if exists affiliate_sale_terminal_immutable on public.affiliate_sales;
create trigger affiliate_sale_terminal_immutable before update on public.affiliate_sales for each row execute function public.affiliate_protect_terminal_sale();
drop trigger if exists affiliate_rule_immutable on public.affiliate_rule_versions;
create trigger affiliate_rule_immutable before update or delete on public.affiliate_rule_versions for each row when (old.status in ('published','retired')) execute function public.affiliate_prevent_mutation();
drop trigger if exists affiliate_decision_immutable on public.affiliate_commission_decisions;
create trigger affiliate_decision_immutable before update or delete on public.affiliate_commission_decisions for each row execute function public.affiliate_prevent_mutation();
drop trigger if exists affiliate_ledger_append_only on public.affiliate_ledger_entries;
create trigger affiliate_ledger_append_only before update or delete on public.affiliate_ledger_entries for each row execute function public.affiliate_prevent_delete();
drop trigger if exists affiliate_schedule_immutable on public.affiliate_commission_schedules;
create trigger affiliate_schedule_immutable before update or delete on public.affiliate_commission_schedules for each row execute function public.affiliate_prevent_mutation();
drop trigger if exists affiliate_team_decision_immutable on public.affiliate_team_reward_decisions;
create trigger affiliate_team_decision_immutable before update or delete on public.affiliate_team_reward_decisions for each row execute function public.affiliate_prevent_mutation();
create or replace function public.affiliate_protect_payout_batch() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'AFFILIATE_PAYOUT_BATCH_IMMUTABLE'; end if;
  if old.status in ('paid','reconciled') then raise exception 'AFFILIATE_PAYOUT_BATCH_IMMUTABLE'; end if;
  if old.status<>'draft' and (old.amount_minor<>new.amount_minor or old.snapshot_hash<>new.snapshot_hash or old.period_start<>new.period_start or old.period_end<>new.period_end) then raise exception 'AFFILIATE_PAYOUT_SNAPSHOT_IMMUTABLE'; end if;
  return new;
end $$;
drop trigger if exists affiliate_payout_batch_immutable on public.affiliate_payout_batches;
create trigger affiliate_payout_batch_immutable before update or delete on public.affiliate_payout_batches for each row execute function public.affiliate_protect_payout_batch();
create or replace function public.affiliate_protect_payout_item() returns trigger language plpgsql as $$ begin if tg_op='DELETE' then raise exception 'AFFILIATE_PAYOUT_ITEM_IMMUTABLE'; end if; if old.batch_id<>new.batch_id or old.affiliate_id<>new.affiliate_id or old.amount_minor<>new.amount_minor or old.idempotency_key<>new.idempotency_key then raise exception 'AFFILIATE_PAYOUT_ITEM_IMMUTABLE'; end if; return new; end $$;
drop trigger if exists affiliate_payout_item_immutable on public.affiliate_payout_items;
create trigger affiliate_payout_item_immutable before update or delete on public.affiliate_payout_items for each row execute function public.affiliate_protect_payout_item();
drop trigger if exists affiliate_commission_audit_immutable on public.affiliate_commission_audits;
create trigger affiliate_commission_audit_immutable before update or delete on public.affiliate_commission_audits for each row execute function public.affiliate_prevent_mutation();
drop trigger if exists affiliate_audit_append_only on public.affiliate_audit_log;
create trigger affiliate_audit_append_only before update or delete on public.affiliate_audit_log for each row execute function public.affiliate_prevent_delete();
create or replace function public.affiliate_protect_published_content() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'AFFILIATE_IMMUTABLE'; end if;
  if old.body<>new.body or old.variables<>new.variables or old.checksum<>new.checksum or old.content_id<>new.content_id or old.version<>new.version then raise exception 'AFFILIATE_IMMUTABLE'; end if;
  return new;
end $$;
drop trigger if exists affiliate_content_immutable on public.affiliate_content_versions;
create trigger affiliate_content_immutable before update or delete on public.affiliate_content_versions for each row when (old.status in ('published','retired','rolled_back')) execute function public.affiliate_protect_published_content();

do $$ declare item text; begin
  foreach item in array array[
    'affiliate_programs','affiliate_rule_versions','affiliate_program_capabilities','affiliate_program_channels','affiliate_applications','affiliate_memberships','affiliate_operator_roles','affiliate_profiles','affiliate_policy_acceptances','affiliate_quiz_attempts','affiliate_activation_actions','affiliate_activation_events',
    'affiliate_links','affiliate_click_events','affiliate_attributions','affiliate_customer_identity_links','affiliate_attribution_adjustments','affiliate_referral_relationships','affiliate_sales','affiliate_commission_decisions','affiliate_commission_audits','affiliate_commission_schedules','affiliate_commission_adjustments','affiliate_integrity_incidents','affiliate_ledger_entries',
    'affiliate_payout_accounts','affiliate_payout_security','affiliate_payout_batches','affiliate_payout_items','affiliate_payout_attempts','affiliate_reconciliations','affiliate_teams',
    'affiliate_team_members','affiliate_team_months','affiliate_team_reward_decisions','affiliate_compliance_cases','affiliate_policy_violations','affiliate_stop_contact_hashes','affiliate_content_items','affiliate_content_versions','affiliate_content_blocks','affiliate_content_approvals','affiliate_content_impacts','affiliate_content_publications','affiliate_content_localizations','affiliate_content_assets','affiliate_content_usage_events','affiliate_content_sync_targets',
    'affiliate_telegram_channels','affiliate_telegram_schedules','affiliate_telegram_event_rules','affiliate_telegram_publications','affiliate_telegram_publication_jobs','affiliate_telegram_failures','affiliate_telegram_win_consents','affiliate_telegram_message_slots','affiliate_outbox_events','affiliate_dead_letters','affiliate_idempotency_keys','affiliate_audit_log'
  ] loop execute format('alter table public.%I enable row level security',item); execute format('revoke all on public.%I from public,anon,authenticated',item); execute format('grant select,insert,update,delete on public.%I to service_role',item); end loop;
end $$;

grant select,insert on public.affiliate_applications to authenticated;
grant select on public.affiliate_memberships,public.affiliate_activation_events,public.affiliate_ledger_entries,public.affiliate_payout_items,public.affiliate_content_versions to authenticated;

create policy affiliate_applications_owner_select on public.affiliate_applications for select to authenticated using(user_id=(select auth.uid()));
create policy affiliate_applications_owner_insert on public.affiliate_applications for insert to authenticated with check(user_id=(select auth.uid()) and country_code='IN' and status='submitted');
create policy affiliate_memberships_owner_select on public.affiliate_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy affiliate_activation_owner_select on public.affiliate_activation_events for select to authenticated using(exists(select 1 from public.affiliate_memberships m where m.id=membership_id and m.user_id=(select auth.uid())));
create policy affiliate_ledger_owner_select on public.affiliate_ledger_entries for select to authenticated using(posting_state<>'shadow' and exists(select 1 from public.affiliate_memberships m where m.id=affiliate_id and m.user_id=(select auth.uid())));
create policy affiliate_payout_owner_select on public.affiliate_payout_items for select to authenticated using(exists(select 1 from public.affiliate_memberships m where m.id=affiliate_id and m.user_id=(select auth.uid())));
create policy affiliate_content_published_select on public.affiliate_content_versions for select to authenticated using(status='published' and published_at<=now());

insert into public.affiliate_programs(id,name,country_code,timezone,status) values
('secwyn-india','Secwyn India Affiliate','IN','Asia/Kolkata','shadow'),
('flowwyn-placeholder','Flowwyn Placeholder','IN','Asia/Kolkata','draft') on conflict(id) do nothing;

insert into public.affiliate_rule_versions(program_id,version,status,effective_from,rules,checksum)
values('secwyn-india',1,'approved','9999-01-01T00:00:00Z',
  '{"phase":"launch","currency":"USD","rounding":"HALF_UP","direct":{"starter":{"monthly":2500,"annual":12000},"growth":{"monthly":10000,"annual":60000},"scale":{"monthly":30000,"annual":150000}},"attribution":{"click_to_registration_days":30,"registration_to_payment_days":90,"manual_extension_days":30,"max_days":120,"max_generation":1},"reserve":{"day_30_bps":8000,"day_60_bps":2000},"payout":{"minimum_minor":5000,"day":28,"freeze_hours":72}}'::jsonb,
  encode(digest('{"program":"secwyn-india","version":1,"phase":"launch"}','sha256'),'hex'))
on conflict(program_id,version) do nothing;

insert into public.affiliate_rule_versions(program_id,version,status,effective_from,rules,checksum)
values('secwyn-india',2,'approved','9999-01-01T00:00:00Z',
  '{"phase":"evergreen","currency":"USD","rounding":"HALF_UP","direct":{"starter":{"monthly":1500,"annual":10000},"growth":{"monthly":7500,"annual":50000},"scale":{"monthly":25000,"annual":120000}},"incentive_cap_bps":1100}'::jsonb,
  encode(digest('{"program":"secwyn-india","version":2,"phase":"evergreen"}','sha256'),'hex'))
on conflict(program_id,version) do nothing;

create or replace function public.affiliate_claim_idempotency(
  p_namespace text,p_key text,p_request_hash text,p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.affiliate_idempotency_keys;
begin
  insert into public.affiliate_idempotency_keys(namespace,key,request_hash,expires_at)
  values(p_namespace,p_key,p_request_hash,p_expires_at) on conflict do nothing;
  select * into v_row from public.affiliate_idempotency_keys where namespace=p_namespace and key=p_key for update;
  if v_row.request_hash<>p_request_hash then raise exception 'AFFILIATE_IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('status',v_row.status,'response',v_row.response);
end $$;

create or replace function public.affiliate_submit_application(
  p_user_id uuid,p_answers jsonb,p_policy_version text,p_quiz_version text,p_quiz_score integer,p_ip_hash text,p_user_agent_hash text,p_correlation_id text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_application public.affiliate_applications;
begin
  if p_user_id is null or p_quiz_score<0 or p_quiz_score>5 or p_policy_version='' or p_quiz_version='' then raise exception 'AFFILIATE_APPLICATION_INVALID'; end if;
  insert into public.affiliate_applications(program_id,user_id,country_code,answers,status,updated_at)
  values('secwyn-india',p_user_id,'IN',p_answers,'submitted',now())
  on conflict(program_id,user_id) do update set answers=excluded.answers,status='submitted',review_reason=null,updated_at=now()
  returning * into v_application;
  insert into public.affiliate_policy_acceptances(application_id,policy_version,accepted_at,ip_hash,user_agent_hash)
  values(v_application.id,p_policy_version,now(),p_ip_hash,p_user_agent_hash) on conflict(application_id,policy_version) do nothing;
  insert into public.affiliate_quiz_attempts(application_id,quiz_version,answers,score,passed)
  values(v_application.id,p_quiz_version,p_answers->'quiz',p_quiz_score,p_quiz_score=5);
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values('secwyn-india','application',v_application.id::text,'affiliate.application.submitted',jsonb_build_object('applicationId',v_application.id,'correlationId',p_correlation_id),'application:'||v_application.id||':'||extract(epoch from v_application.updated_at)::bigint)
  on conflict(program_id,idempotency_key) do nothing;
  return v_application.id;
end $$;

create or replace function public.affiliate_review_application(
  p_application_id uuid,p_actor_id uuid,p_action text,p_reason text,p_affiliate_code text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_application public.affiliate_applications; v_membership public.affiliate_memberships; v_now timestamptz:=now();
begin
  if p_action not in ('approve_provisional','reject','suspend') or length(btrim(p_reason))<3 then raise exception 'AFFILIATE_REVIEW_INVALID'; end if;
  select * into v_application from public.affiliate_applications where id=p_application_id for update;
  if not found then raise exception 'AFFILIATE_APPLICATION_NOT_FOUND'; end if;
  if p_action in ('approve_provisional','reject') and v_application.status<>'submitted' then raise exception 'AFFILIATE_APPLICATION_NOT_REVIEWABLE'; end if;
  if p_action='suspend' and v_application.status not in ('provisional','approved') then raise exception 'AFFILIATE_APPLICATION_NOT_SUSPENDABLE'; end if;
  if p_action='approve_provisional' then
    if p_affiliate_code is null or p_affiliate_code='' then raise exception 'AFFILIATE_CODE_REQUIRED'; end if;
    if not exists(select 1 from public.affiliate_policy_acceptances where application_id=p_application_id)
      or not exists(select 1 from public.affiliate_quiz_attempts where application_id=p_application_id and passed=true) then raise exception 'AFFILIATE_ACTIVATION_REQUIREMENTS_INCOMPLETE'; end if;
    insert into public.affiliate_memberships(program_id,user_id,affiliate_code,status,provisional_started_at,provisional_ends_at,expires_no_sale_at)
    values(v_application.program_id,v_application.user_id,p_affiliate_code,'provisional',v_now,v_now+interval '7 days',v_now+interval '90 days')
    on conflict(program_id,user_id) do update set status='provisional',provisional_started_at=v_now,provisional_ends_at=v_now+interval '7 days',expires_no_sale_at=v_now+interval '90 days',updated_at=v_now
    returning * into v_membership;
    update public.affiliate_applications set status='provisional',review_reason=p_reason,updated_at=v_now where id=p_application_id;
  else
    update public.affiliate_applications set status=case when p_action='reject' then 'rejected' else 'suspended' end,review_reason=p_reason,updated_at=v_now where id=p_application_id;
    if p_action='suspend' then update public.affiliate_memberships set status='suspended',updated_at=v_now where program_id=v_application.program_id and user_id=v_application.user_id; end if;
  end if;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,reason,correlation_id) values(p_actor_id,p_action,'affiliate_application',p_application_id::text,p_reason,p_correlation_id);
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values(v_application.program_id,'application',p_application_id::text,'affiliate.application.'||p_action,jsonb_build_object('applicationId',p_application_id,'membershipId',v_membership.id,'correlationId',p_correlation_id),'review:'||p_application_id||':'||p_action||':'||extract(epoch from v_application.updated_at)::bigint)
  on conflict(program_id,idempotency_key) do nothing;
  return jsonb_build_object('applicationId',p_application_id,'membershipId',v_membership.id,'status',p_action);
end $$;

create or replace function public.affiliate_publish_rule_schedule(
  p_program_id text,p_launch_start_at timestamptz,p_actor_id uuid,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_launch public.affiliate_rule_versions; v_evergreen public.affiliate_rule_versions; v_launch_end timestamptz;
begin
  if p_program_id<>'secwyn-india' or p_launch_start_at is null or p_actor_id is null or coalesce(btrim(p_correlation_id),'')='' then raise exception 'AFFILIATE_RULE_PUBLISH_INVALID'; end if;
  v_launch_end:=p_launch_start_at+interval '12 months';
  select * into v_launch from public.affiliate_rule_versions where program_id=p_program_id and version=1 for update;
  select * into v_evergreen from public.affiliate_rule_versions where program_id=p_program_id and version=2 for update;
  if v_launch.id is null or v_evergreen.id is null then raise exception 'AFFILIATE_RULE_SCHEDULE_INCOMPLETE'; end if;
  if v_launch.status='published' and v_evergreen.status='published' then
    if v_launch.effective_from<>p_launch_start_at or v_launch.effective_until<>v_launch_end or v_evergreen.effective_from<>v_launch_end or v_evergreen.effective_until is not null then raise exception 'AFFILIATE_RULE_SCHEDULE_CONFLICT'; end if;
    return jsonb_build_object('programId',p_program_id,'status','published','replayed',true);
  end if;
  if v_launch.status<>'approved' or v_evergreen.status<>'approved' then raise exception 'AFFILIATE_RULES_NOT_APPROVED'; end if;
  update public.affiliate_rule_versions set status='published',effective_from=p_launch_start_at,effective_until=v_launch_end where id=v_launch.id;
  update public.affiliate_rule_versions set status='published',effective_from=v_launch_end,effective_until=null where id=v_evergreen.id;
  update public.affiliate_programs set launch_start_at=p_launch_start_at,status='shadow' where id=p_program_id;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values(p_program_id,'affiliate_program',p_program_id,'affiliate.rules.published',jsonb_build_object('programId',p_program_id,'launchStartAt',p_launch_start_at,'evergreenStartAt',v_launch_end,'correlationId',p_correlation_id),'rule-schedule:'||p_program_id||':'||extract(epoch from p_launch_start_at)::bigint)
  on conflict(program_id,idempotency_key) do nothing;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,after_state,correlation_id)
  values(p_actor_id,'publish_rule_schedule','affiliate_program',p_program_id,jsonb_build_object('launchStartAt',p_launch_start_at,'evergreenStartAt',v_launch_end),p_correlation_id);
  return jsonb_build_object('programId',p_program_id,'status','published','replayed',false);
end $$;

create or replace function public.affiliate_lock_attribution(
  p_customer_user_id uuid,p_affiliate_id uuid,p_canonical_customer_id text,p_click_at timestamptz,p_source text,p_channel_code text,p_fingerprint text,p_correlation_id text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_member public.affiliate_memberships; v_attribution public.affiliate_attributions;
begin
  select * into v_member from public.affiliate_memberships where id=p_affiliate_id and program_id='secwyn-india' for update;
  if not found or v_member.status not in ('provisional','approved') or v_member.user_id=p_customer_user_id then raise exception 'AFFILIATE_ATTRIBUTION_INELIGIBLE'; end if;
  if p_click_at<now()-interval '30 days' or p_click_at>now()+interval '5 minutes' then raise exception 'AFFILIATE_CLICK_EXPIRED'; end if;
  insert into public.affiliate_attributions(program_id,affiliate_id,canonical_customer_id,generation,click_at,registered_at,expires_at,locked_at,source,channel_code,fingerprint)
  values('secwyn-india',p_affiliate_id,p_canonical_customer_id,1,p_click_at,now(),least(now()+interval '90 days',p_click_at+interval '120 days'),now(),p_source,p_channel_code,p_fingerprint)
  on conflict(program_id,canonical_customer_id) do nothing returning * into v_attribution;
  if v_attribution.id is null then select * into v_attribution from public.affiliate_attributions where program_id='secwyn-india' and canonical_customer_id=p_canonical_customer_id; end if;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values('secwyn-india','attribution',v_attribution.id::text,'affiliate.attribution.locked',jsonb_build_object('attributionId',v_attribution.id,'correlationId',p_correlation_id),'attribution:'||v_attribution.id)
  on conflict(program_id,idempotency_key) do nothing;
  return v_attribution.id;
end $$;

create or replace function public.affiliate_publish_content(p_version_id uuid,p_actor_id uuid,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_version public.affiliate_content_versions;
begin
  select * into v_version from public.affiliate_content_versions where id=p_version_id for update;
  if not found or v_version.status not in ('approved','scheduled') then raise exception 'AFFILIATE_CONTENT_NOT_APPROVED'; end if;
  if v_version.body::text ~ '\{[a-zA-Z][a-zA-Z0-9_.]*\}' then raise exception 'AFFILIATE_CONTENT_UNRESOLVED_VARIABLE'; end if;
  if exists(select 1 from public.affiliate_content_impacts where content_version_id=p_version_id and (requires_rule_review or requires_telegram_sync) and status<>'reviewed') then raise exception 'AFFILIATE_CONTENT_IMPACT_OPEN'; end if;
  update public.affiliate_content_versions set status='published',published_at=now() where id=p_version_id;
  insert into public.affiliate_content_publications(content_version_id,target,published_at,idempotency_key) values(p_version_id,'web',now(),'content-published:'||p_version_id) on conflict(idempotency_key) do nothing;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values('secwyn-india','content_version',p_version_id::text,'affiliate.content.published',jsonb_build_object('contentVersionId',p_version_id,'correlationId',p_correlation_id),'content-published:'||p_version_id) on conflict(program_id,idempotency_key) do nothing;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,correlation_id) values(p_actor_id,'publish','affiliate_content_version',p_version_id::text,p_correlation_id);
  return jsonb_build_object('id',p_version_id,'status','published');
end $$;

create or replace function public.affiliate_record_shadow_decision(
  p_decision_id uuid,p_program_id text,p_sale_id uuid,p_affiliate_id uuid,p_rule_version_id uuid,
  p_amount_minor bigint,p_reason text,p_schedule jsonb,p_fingerprint text,p_calculator_version text,
  p_audit_amount_minor bigint,p_audit_schedule jsonb,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_decision public.affiliate_commission_decisions; v_item jsonb; v_index integer:=0; v_scheduled_total bigint:=0;
begin
  if p_program_id<>'secwyn-india' or p_amount_minor<0 or p_amount_minor<>p_audit_amount_minor or p_schedule<>p_audit_schedule then raise exception 'AFFILIATE_AUDIT_MISMATCH'; end if;
  insert into public.affiliate_commission_decisions(id,program_id,sale_id,affiliate_id,rule_version_id,currency,amount_minor,status,reason,schedule,fingerprint,calculator_version)
  values(p_decision_id,p_program_id,p_sale_id,p_affiliate_id,p_rule_version_id,'USD',p_amount_minor,'shadow',p_reason,p_schedule,p_fingerprint,p_calculator_version)
  on conflict(program_id,sale_id) do nothing;
  select * into v_decision from public.affiliate_commission_decisions where program_id=p_program_id and sale_id=p_sale_id;
  if v_decision.fingerprint<>p_fingerprint or v_decision.status<>'shadow' or v_decision.affiliate_id<>p_affiliate_id or v_decision.rule_version_id<>p_rule_version_id or v_decision.amount_minor<>p_amount_minor then raise exception 'AFFILIATE_DECISION_CONFLICT'; end if;
  insert into public.affiliate_commission_audits(decision_id,calculator_version,expected_amount_minor,expected_schedule,matched)
  values(v_decision.id,p_calculator_version||':audit',p_audit_amount_minor,p_audit_schedule,true) on conflict do nothing;
  for v_item in select value from jsonb_array_elements(p_schedule) loop
    if v_item->'amount'->>'currency'<>'USD' or (v_item->'amount'->>'amountMinor')::bigint<0 then raise exception 'AFFILIATE_INVALID_SCHEDULE'; end if;
    v_scheduled_total:=v_scheduled_total+(v_item->'amount'->>'amountMinor')::bigint;
    insert into public.affiliate_ledger_entries(program_id,affiliate_id,decision_id,entry_type,currency,amount_minor,effective_at,posting_state,idempotency_key,correlation_id,metadata)
    values(p_program_id,p_affiliate_id,v_decision.id,'commission','USD',(v_item->'amount'->>'amountMinor')::bigint,(v_item->>'releaseAt')::timestamptz,'shadow','decision:'||v_decision.id||':schedule:'||v_index,p_correlation_id,jsonb_build_object('status','shadow')) on conflict(program_id,idempotency_key) do nothing;
    v_index:=v_index+1;
  end loop;
  if v_scheduled_total<>p_amount_minor then raise exception 'AFFILIATE_SCHEDULE_TOTAL_MISMATCH'; end if;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values(p_program_id,'commission_decision',v_decision.id::text,'affiliate.commission.shadow_recorded',jsonb_build_object('decisionId',v_decision.id,'correlationId',p_correlation_id),'decision:'||v_decision.id||':shadow')
  on conflict(program_id,idempotency_key) do nothing;
  return jsonb_build_object('decisionId',v_decision.id,'status','shadow');
end $$;

create or replace function public.affiliate_record_real_decision(
  p_decision_id uuid,p_program_id text,p_sale_id uuid,p_affiliate_id uuid,p_rule_version_id uuid,
  p_amount_minor bigint,p_reason text,p_schedule jsonb,p_fingerprint text,p_calculator_version text,
  p_audit_amount_minor bigint,p_audit_schedule jsonb,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_decision public.affiliate_commission_decisions; v_item jsonb; v_index integer:=0; v_total bigint:=0;
begin
  if p_program_id<>'secwyn-india' or p_amount_minor<0 or p_amount_minor<>p_audit_amount_minor or p_schedule<>p_audit_schedule then raise exception 'AFFILIATE_AUDIT_MISMATCH'; end if;
  insert into public.affiliate_commission_decisions(id,program_id,sale_id,affiliate_id,rule_version_id,currency,amount_minor,status,reason,schedule,fingerprint,calculator_version)
  values(p_decision_id,p_program_id,p_sale_id,p_affiliate_id,p_rule_version_id,'USD',p_amount_minor,'held',p_reason,p_schedule,p_fingerprint,p_calculator_version) on conflict(program_id,sale_id) do nothing;
  select * into v_decision from public.affiliate_commission_decisions where program_id=p_program_id and sale_id=p_sale_id;
  if v_decision.fingerprint<>p_fingerprint or v_decision.status<>'held' or v_decision.affiliate_id<>p_affiliate_id or v_decision.rule_version_id<>p_rule_version_id or v_decision.amount_minor<>p_amount_minor then raise exception 'AFFILIATE_DECISION_CONFLICT'; end if;
  insert into public.affiliate_commission_audits(decision_id,calculator_version,expected_amount_minor,expected_schedule,matched)
  values(v_decision.id,p_calculator_version||':audit',p_audit_amount_minor,p_audit_schedule,true) on conflict do nothing;
  for v_item in select value from jsonb_array_elements(p_schedule) loop
    if v_item->'amount'->>'currency'<>'USD' or (v_item->'amount'->>'amountMinor')::bigint<0 then raise exception 'AFFILIATE_INVALID_SCHEDULE'; end if;
    v_total:=v_total+(v_item->'amount'->>'amountMinor')::bigint;
    insert into public.affiliate_commission_schedules(decision_id,installment,release_at,amount_minor,status)
    values(v_decision.id,v_index,(v_item->>'releaseAt')::timestamptz,(v_item->'amount'->>'amountMinor')::bigint,'held') on conflict(decision_id,installment) do nothing;
    insert into public.affiliate_ledger_entries(program_id,affiliate_id,decision_id,entry_type,currency,amount_minor,effective_at,posting_state,idempotency_key,correlation_id,metadata)
    values(p_program_id,p_affiliate_id,v_decision.id,'commission','USD',(v_item->'amount'->>'amountMinor')::bigint,(v_item->>'releaseAt')::timestamptz,'held','decision:'||v_decision.id||':held:'||v_index,p_correlation_id,jsonb_build_object('status','held')) on conflict(program_id,idempotency_key) do nothing;
    v_index:=v_index+1;
  end loop;
  if v_total<>p_amount_minor then raise exception 'AFFILIATE_SCHEDULE_TOTAL_MISMATCH'; end if;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values(p_program_id,'commission_decision',v_decision.id::text,'affiliate.commission.held_recorded',jsonb_build_object('decisionId',v_decision.id,'correlationId',p_correlation_id),'decision:'||v_decision.id||':held')
  on conflict(program_id,idempotency_key) do nothing;
  return jsonb_build_object('decisionId',v_decision.id,'status','held');
end $$;

create or replace function public.affiliate_record_sale_decision(
  p_mode text,p_sale_id uuid,p_program_id text,p_attribution_id uuid,p_provider text,p_provider_transaction_id text,
  p_canonical_customer_id text,p_plan text,p_billing_interval text,p_gross_amount_minor bigint,p_paid_at timestamptz,p_raw_event_ref text,
  p_decision_id uuid,p_affiliate_id uuid,p_rule_version_id uuid,p_amount_minor bigint,p_reason text,p_schedule jsonb,
  p_fingerprint text,p_calculator_version text,p_audit_amount_minor bigint,p_audit_schedule jsonb,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sale public.affiliate_sales; v_result jsonb;
begin
  if p_mode not in ('shadow','real') or p_program_id<>'secwyn-india' or p_provider<>'creem' or p_gross_amount_minor<=0 then raise exception 'AFFILIATE_SALE_INPUT_INVALID'; end if;
  insert into public.affiliate_sales(id,program_id,attribution_id,provider,provider_transaction_id,canonical_customer_id,plan,billing_interval,currency,gross_amount_minor,paid_at,status,raw_event_ref)
  values(p_sale_id,p_program_id,p_attribution_id,p_provider,p_provider_transaction_id,p_canonical_customer_id,p_plan,p_billing_interval,'USD',p_gross_amount_minor,p_paid_at,'qualified',p_raw_event_ref)
  on conflict(program_id,provider,provider_transaction_id) do nothing;
  select * into v_sale from public.affiliate_sales where program_id=p_program_id and provider=p_provider and provider_transaction_id=p_provider_transaction_id for update;
  if not found or v_sale.status<>'qualified' or v_sale.attribution_id<>p_attribution_id or v_sale.canonical_customer_id<>p_canonical_customer_id or v_sale.plan<>p_plan or v_sale.billing_interval<>p_billing_interval or v_sale.gross_amount_minor<>p_gross_amount_minor then raise exception 'AFFILIATE_SALE_CONFLICT'; end if;
  if p_mode='shadow' then
    v_result:=public.affiliate_record_shadow_decision(p_decision_id,p_program_id,v_sale.id,p_affiliate_id,p_rule_version_id,p_amount_minor,p_reason,p_schedule,p_fingerprint,p_calculator_version,p_audit_amount_minor,p_audit_schedule,p_correlation_id);
  else
    v_result:=public.affiliate_record_real_decision(p_decision_id,p_program_id,v_sale.id,p_affiliate_id,p_rule_version_id,p_amount_minor,p_reason,p_schedule,p_fingerprint,p_calculator_version,p_audit_amount_minor,p_audit_schedule,p_correlation_id);
  end if;
  return v_result||jsonb_build_object('saleId',v_sale.id);
end $$;

create or replace function public.affiliate_record_reversal(
  p_program_id text,p_sale_id uuid,p_affiliate_id uuid,p_decision_id uuid,p_provider_event_id text,
  p_reversal_type text,p_reversed_gross_minor bigint,p_clawback_minor bigint,p_posting_state text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sale public.affiliate_sales; v_decision public.affiliate_commission_decisions; v_existing public.affiliate_ledger_entries; v_prior_clawback bigint:=0; v_prior_reversed_gross bigint:=0;
begin
  if p_program_id<>'secwyn-india' or p_reversal_type not in ('refund','chargeback') or p_reversed_gross_minor<=0 or p_clawback_minor<0 or p_posting_state not in ('shadow','payable') then raise exception 'AFFILIATE_REVERSAL_INPUT_INVALID'; end if;
  select * into v_sale from public.affiliate_sales where id=p_sale_id and program_id=p_program_id for update;
  select * into v_decision from public.affiliate_commission_decisions where id=p_decision_id and sale_id=p_sale_id and affiliate_id=p_affiliate_id for update;
  if not found or v_sale.id is null or p_clawback_minor>v_decision.amount_minor then raise exception 'AFFILIATE_REVERSAL_CONFLICT'; end if;
  select * into v_existing from public.affiliate_ledger_entries where program_id=p_program_id and idempotency_key='reversal:'||p_provider_event_id;
  if found then
    if v_existing.decision_id<>p_decision_id or v_existing.amount_minor<>-p_clawback_minor or v_existing.metadata->>'reason'<>p_reversal_type then raise exception 'AFFILIATE_REVERSAL_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('saleId',p_sale_id,'status',p_reversal_type,'replayed',true);
  end if;
  select coalesce(sum(-amount_minor),0),coalesce(sum((metadata->>'reversedGrossMinor')::bigint),0)
    into v_prior_clawback,v_prior_reversed_gross from public.affiliate_ledger_entries
    where program_id=p_program_id and decision_id=p_decision_id and entry_type in ('clawback','reversal') and amount_minor<=0;
  if v_prior_clawback+p_clawback_minor>v_decision.amount_minor then raise exception 'AFFILIATE_CLAWBACK_EXCEEDS_DECISION'; end if;
  insert into public.affiliate_ledger_entries(program_id,affiliate_id,decision_id,entry_type,currency,amount_minor,effective_at,posting_state,idempotency_key,correlation_id,metadata)
  values(p_program_id,p_affiliate_id,p_decision_id,'clawback','USD',-p_clawback_minor,now(),p_posting_state,'reversal:'||p_provider_event_id,p_correlation_id,jsonb_build_object('status',p_posting_state,'reason',p_reversal_type,'reversedGrossMinor',p_reversed_gross_minor))
  on conflict(program_id,idempotency_key) do nothing;
  if p_reversal_type='chargeback' or v_prior_reversed_gross+p_reversed_gross_minor>=v_sale.gross_amount_minor then update public.affiliate_sales set status=case when p_reversal_type='chargeback' then 'chargeback' else 'refunded' end where id=p_sale_id; end if;
  insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
  values(p_program_id,'sale',p_sale_id::text,'affiliate.sale.'||p_reversal_type,jsonb_build_object('saleId',p_sale_id,'decisionId',p_decision_id,'correlationId',p_correlation_id),'reversal:'||p_provider_event_id)
  on conflict(program_id,idempotency_key) do nothing;
  return jsonb_build_object('saleId',p_sale_id,'status',p_reversal_type);
end $$;

create or replace function public.affiliate_claim_outbox(p_worker text,p_limit integer default 25)
returns setof public.affiliate_outbox_events language plpgsql security definer set search_path=public as $$
begin
  return query update public.affiliate_outbox_events e set status='processing',locked_at=now(),locked_by=p_worker,attempt_count=attempt_count+1
  where e.id in(select id from public.affiliate_outbox_events where status='pending' and available_at<=now() order by created_at for update skip locked limit greatest(1,least(p_limit,100))) returning e.*;
end $$;

create or replace function public.affiliate_claim_telegram_publications(p_worker text,p_types text[],p_limit integer default 5)
returns setof public.affiliate_telegram_publications language plpgsql security definer set search_path=public as $$
begin
  if p_worker is null or btrim(p_worker)='' or coalesce(array_length(p_types,1),0)=0 then raise exception 'AFFILIATE_TELEGRAM_CLAIM_INVALID'; end if;
  return query update public.affiliate_telegram_publications p
    set status='processing',locked_at=now(),locked_by=p_worker
    where p.id in(
      select id from public.affiliate_telegram_publications
      where status='pending' and scheduled_at<=now() and publication_type=any(p_types) and attempt_count<5
      order by scheduled_at for update skip locked limit greatest(1,least(p_limit,10))
    ) returning p.*;
end $$;

revoke all on function public.affiliate_claim_idempotency(text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.affiliate_submit_application(uuid,jsonb,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_review_application(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_publish_rule_schedule(text,timestamptz,uuid,text) from public,anon,authenticated;
revoke all on function public.affiliate_lock_attribution(uuid,uuid,text,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_publish_content(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.affiliate_record_shadow_decision(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.affiliate_record_real_decision(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.affiliate_record_sale_decision(text,uuid,text,uuid,text,text,text,text,text,bigint,timestamptz,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.affiliate_record_reversal(text,uuid,uuid,uuid,text,text,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_claim_outbox(text,integer) from public,anon,authenticated;
revoke all on function public.affiliate_claim_telegram_publications(text,text[],integer) from public,anon,authenticated;
grant execute on function public.affiliate_claim_idempotency(text,text,text,timestamptz) to service_role;
grant execute on function public.affiliate_submit_application(uuid,jsonb,text,text,integer,text,text,text) to service_role;
grant execute on function public.affiliate_review_application(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.affiliate_publish_rule_schedule(text,timestamptz,uuid,text) to service_role;
grant execute on function public.affiliate_lock_attribution(uuid,uuid,text,timestamptz,text,text,text,text) to service_role;
grant execute on function public.affiliate_publish_content(uuid,uuid,text) to service_role;
grant execute on function public.affiliate_record_shadow_decision(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) to service_role;
grant execute on function public.affiliate_record_real_decision(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) to service_role;
grant execute on function public.affiliate_record_sale_decision(text,uuid,text,uuid,text,text,text,text,text,bigint,timestamptz,text,uuid,uuid,uuid,bigint,text,jsonb,text,text,bigint,jsonb,text) to service_role;
grant execute on function public.affiliate_record_reversal(text,uuid,uuid,uuid,text,text,bigint,bigint,text,text) to service_role;
grant execute on function public.affiliate_claim_outbox(text,integer) to service_role;
grant execute on function public.affiliate_claim_telegram_publications(text,text[],integer) to service_role;

commit;
