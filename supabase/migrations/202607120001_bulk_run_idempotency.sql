-- Secwyn P0 only: durable, resumable bulk processing. Not a Task 2D ledger migration.
-- Do not execute until the production preflight in BULK_RUN_MIGRATION_REVIEW.md is approved.

create table if not exists public.bulk_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('web', 'sheets', 'api')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._-]{16,200}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','partial','completed','cancelled','expired','failed_terminal')),
  total_contacts integer not null check (total_contacts between 1 and 5000),
  completed_contacts integer not null default 0 check (completed_contacts between 0 and total_contacts),
  failed_contacts integer not null default 0 check (failed_contacts between 0 and total_contacts),
  reserved_credits integer not null check (reserved_credits >= 0),
  released_credits integer not null default 0 check (released_credits between 0 and reserved_credits),
  policy_version integer not null,
  last_error text,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.bulk_run_chunks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.bulk_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{16,240}$'),
  input_fingerprint text not null check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed_retryable','failed_terminal','cancelled','expired')),
  contact_count integer not null check (contact_count between 1 and 50),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  contacts jsonb not null check (jsonb_typeof(contacts) = 'array' and jsonb_array_length(contacts) between 1 and 50),
  result_payload jsonb,
  last_error text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  claim_token uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, chunk_index),
  unique (user_id, idempotency_key)
);

create unique index if not exists bulk_runs_active_fingerprint_idx on public.bulk_runs(user_id, request_fingerprint)
  where status in ('pending','processing','partial');
create index if not exists bulk_runs_user_updated_idx on public.bulk_runs(user_id, updated_at desc);
create index if not exists bulk_run_chunks_claim_idx on public.bulk_run_chunks(run_id, status, chunk_index);

alter table public.bulk_runs enable row level security;
alter table public.bulk_run_chunks enable row level security;
create policy "bulk runs readable by owner" on public.bulk_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "bulk chunks readable by owner" on public.bulk_run_chunks for select to authenticated using ((select auth.uid()) = user_id);

-- All functions are service-role-only. Public callers cannot supply user_id or reserve credits.
create or replace function public.create_bulk_run(
  p_user_id uuid, p_source text, p_chunks jsonb, p_idempotency_key text,
  p_request_fingerprint text, p_policy_version integer default 1
) returns table(id uuid, replayed boolean, status text, total_contacts integer, chunk_count integer,
                reserved_credits integer, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_existing public.bulk_runs; v_total integer; v_remaining integer; v_run public.bulk_runs; v_chunk jsonb;
begin
  if p_user_id is null or p_source not in ('web','sheets','api') or p_idempotency_key !~ '^[A-Za-z0-9._-]{16,200}$'
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_chunks) <> 'array' then raise exception 'BULK_RUN_INVALID_INPUT'; end if;
  select * into v_existing from public.bulk_runs where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then raise exception 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    return query select v_existing.id, true, v_existing.status, v_existing.total_contacts,
      (select count(*)::integer from public.bulk_run_chunks where run_id = v_existing.id), v_existing.reserved_credits, v_existing.created_at, v_existing.expires_at;
    return;
  end if;
  select coalesce(sum(jsonb_array_length(value->'contacts')), 0)::integer into v_total from jsonb_array_elements(p_chunks);
  if v_total not between 1 and 5000 or exists (
    select 1 from jsonb_array_elements(p_chunks) with ordinality x(value, ordinal)
    where jsonb_typeof(x.value->'contacts') <> 'array'
      or jsonb_array_length(x.value->'contacts') not between 1 and 50
      or (x.value->>'input_fingerprint') !~ '^[0-9a-f]{64}$'
      or (x.value->>'chunk_index') !~ '^[0-9]+$'
      or (x.value->>'chunk_index')::integer <> x.ordinal - 1
  ) then raise exception 'BULK_RUN_CONTACT_LIMIT'; end if;
  if exists (
    select 1
    from (
      select lower(trim(email.value #>> '{}')) as email
      from jsonb_array_elements(p_chunks) as chunk(value)
      cross join lateral jsonb_array_elements(chunk.value->'contacts') as email(value)
    ) normalized
    group by email
    having count(*) > 1
  ) then raise exception 'BULK_RUN_DUPLICATE_CONTACT'; end if;
  select * into v_existing from public.bulk_runs where user_id = p_user_id and request_fingerprint = p_request_fingerprint and status in ('pending','processing','partial') for update;
  if found then raise exception 'ACTIVE_DUPLICATE_RUN:%', v_existing.id; end if;
  update public.profiles set credits_remaining = credits_remaining - v_total where id = p_user_id and credits_remaining >= v_total returning credits_remaining into v_remaining;
  if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into public.bulk_runs(user_id,source,idempotency_key,request_fingerprint,status,total_contacts,reserved_credits,policy_version)
    values(p_user_id,p_source,p_idempotency_key,p_request_fingerprint,'pending',v_total,v_total,p_policy_version) returning * into v_run;
  for v_chunk in select value from jsonb_array_elements(p_chunks) loop
    insert into public.bulk_run_chunks(run_id,user_id,chunk_index,idempotency_key,input_fingerprint,contact_count,contacts)
    values(v_run.id,p_user_id,(v_chunk->>'chunk_index')::integer,v_run.id::text || ':' || (v_chunk->>'chunk_index'),v_chunk->>'input_fingerprint',jsonb_array_length(v_chunk->'contacts'),v_chunk->'contacts');
  end loop;
  return query select v_run.id,false,v_run.status,v_run.total_contacts,jsonb_array_length(p_chunks),v_run.reserved_credits,v_run.created_at,v_run.expires_at;
end $$;

create or replace function public.claim_bulk_run_chunk(p_user_id uuid, p_run_id uuid, p_chunk_index integer, p_lease_seconds integer default 60)
returns public.bulk_run_chunks language plpgsql security definer set search_path = '' as $$
declare v_chunk public.bulk_run_chunks;
begin
  if p_lease_seconds not between 15 and 300 then raise exception 'BULK_RUN_INVALID_LEASE'; end if;
  select * into v_chunk from public.bulk_run_chunks where run_id=p_run_id and user_id=p_user_id and chunk_index=p_chunk_index for update;
  if not found then raise exception 'BULK_RUN_CHUNK_NOT_FOUND'; end if;
  if v_chunk.status='completed' or v_chunk.status in ('cancelled','expired','failed_terminal') then return v_chunk; end if;
  if v_chunk.status='processing' and v_chunk.lease_expires_at > now() then return v_chunk; end if;
  if v_chunk.attempt_count >= 2 then update public.bulk_run_chunks set status='failed_terminal',updated_at=now() where id=v_chunk.id returning * into v_chunk; return v_chunk; end if;
  update public.bulk_run_chunks set status='processing',attempt_count=attempt_count+1,claimed_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),claim_token=gen_random_uuid(),updated_at=now() where id=v_chunk.id returning * into v_chunk;
  update public.bulk_runs set status='processing',last_activity_at=now(),updated_at=now() where id=p_run_id and status='pending';
  return v_chunk;
end $$;

create or replace function public.finalize_bulk_run_chunk(p_user_id uuid,p_run_id uuid,p_chunk_index integer,p_claim_token uuid,p_result jsonb)
returns public.bulk_run_chunks language plpgsql security definer set search_path = '' as $$
declare v_chunk public.bulk_run_chunks; v_run public.bulk_runs;
begin
  select * into v_chunk from public.bulk_run_chunks where run_id=p_run_id and user_id=p_user_id and chunk_index=p_chunk_index for update;
  if not found then raise exception 'BULK_RUN_CHUNK_NOT_FOUND'; end if;
  if v_chunk.status='completed' then return v_chunk; end if;
  if v_chunk.status <> 'processing' or v_chunk.claim_token is distinct from p_claim_token or v_chunk.lease_expires_at <= now() then raise exception 'BULK_RUN_STALE_CLAIM'; end if;
  update public.bulk_run_chunks set status='completed',result_payload=p_result,completed_at=now(),lease_expires_at=null,claim_token=null,updated_at=now() where id=v_chunk.id returning * into v_chunk;
  update public.bulk_runs set completed_contacts=completed_contacts+v_chunk.contact_count,last_activity_at=now(),updated_at=now() where id=p_run_id returning * into v_run;
  if v_run.completed_contacts=v_run.total_contacts then update public.bulk_runs set status='completed',completed_at=now(),updated_at=now() where id=p_run_id; end if;
  return v_chunk;
end $$;

create or replace function public.fail_bulk_run_chunk(p_user_id uuid,p_run_id uuid,p_chunk_index integer,p_claim_token uuid,p_error text,p_retryable boolean)
returns public.bulk_run_chunks language plpgsql security definer set search_path = '' as $$
declare v_chunk public.bulk_run_chunks;
begin
  select * into v_chunk from public.bulk_run_chunks where run_id=p_run_id and user_id=p_user_id and chunk_index=p_chunk_index for update;
  if not found then raise exception 'BULK_RUN_CHUNK_NOT_FOUND'; end if;
  if v_chunk.status='completed' then raise exception 'BULK_RUN_COMPLETED_CHUNK_CANNOT_RELEASE'; end if;
  if v_chunk.status in ('cancelled','expired','failed_terminal') then return v_chunk; end if;
  if v_chunk.claim_token is distinct from p_claim_token then raise exception 'BULK_RUN_STALE_CLAIM'; end if;
  update public.bulk_run_chunks set status=case when p_retryable and v_chunk.attempt_count < 2 then 'failed_retryable' else 'failed_terminal' end,last_error=left(coalesce(p_error,'processing failed'),500),lease_expires_at=null,claim_token=null,updated_at=now() where id=v_chunk.id returning * into v_chunk;
  update public.bulk_runs set failed_contacts=(select coalesce(sum(contact_count),0) from public.bulk_run_chunks where run_id=p_run_id and status='failed_terminal'),status='partial',last_error=v_chunk.last_error,last_activity_at=now(),updated_at=now() where id=p_run_id and status <> 'completed';
  return v_chunk;
end $$;

create or replace function public.release_bulk_run_unfinished(p_user_id uuid,p_run_id uuid,p_reason text,p_terminal_status text default 'cancelled')
returns public.bulk_runs language plpgsql security definer set search_path = '' as $$
declare v_run public.bulk_runs; v_release integer;
begin
  if p_terminal_status not in ('cancelled','expired') then raise exception 'BULK_RUN_INVALID_TERMINAL_STATUS'; end if;
  select * into v_run from public.bulk_runs where id=p_run_id and user_id=p_user_id for update;
  if not found then raise exception 'BULK_RUN_NOT_FOUND'; end if;
  if v_run.status='completed' then raise exception 'BULK_RUN_COMPLETED'; end if;
  if v_run.status in ('cancelled','expired') then return v_run; end if;
  select coalesce(sum(contact_count),0)::integer into v_release from public.bulk_run_chunks where run_id=p_run_id and status <> 'completed';
  v_release := least(v_release, v_run.reserved_credits-v_run.released_credits);
  if v_release > 0 then update public.profiles set credits_remaining=credits_remaining+v_release where id=p_user_id; end if;
  update public.bulk_run_chunks set status=p_terminal_status,lease_expires_at=null,claim_token=null,updated_at=now() where run_id=p_run_id and status <> 'completed';
  update public.bulk_runs set status=p_terminal_status,released_credits=released_credits+v_release,failed_contacts=v_release,last_error=left(coalesce(p_reason,p_terminal_status),500),cancelled_at=case when p_terminal_status='cancelled' then now() else cancelled_at end,last_activity_at=now(),updated_at=now() where id=p_run_id returning * into v_run;
  return v_run;
end $$;

create or replace function public.expire_stale_bulk_runs(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_run record; v_count integer:=0;
begin
  for v_run in select id,user_id from public.bulk_runs where status in ('pending','processing','partial') and expires_at <= p_now for update skip locked loop
    perform public.release_bulk_run_unfinished(v_run.user_id,v_run.id,'Bulk run expired','expired'); v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

revoke all on table public.bulk_runs, public.bulk_run_chunks from anon, authenticated;
revoke all on function public.create_bulk_run(uuid,text,jsonb,text,text,integer), public.claim_bulk_run_chunk(uuid,uuid,integer,integer), public.finalize_bulk_run_chunk(uuid,uuid,integer,uuid,jsonb), public.fail_bulk_run_chunk(uuid,uuid,integer,uuid,text,boolean), public.release_bulk_run_unfinished(uuid,uuid,text,text), public.expire_stale_bulk_runs(timestamptz) from public, anon, authenticated;
grant execute on function public.create_bulk_run(uuid,text,jsonb,text,text,integer), public.claim_bulk_run_chunk(uuid,uuid,integer,integer), public.finalize_bulk_run_chunk(uuid,uuid,integer,uuid,jsonb), public.fail_bulk_run_chunk(uuid,uuid,integer,uuid,text,boolean), public.release_bulk_run_unfinished(uuid,uuid,text,text), public.expire_stale_bulk_runs(timestamptz) to service_role;
