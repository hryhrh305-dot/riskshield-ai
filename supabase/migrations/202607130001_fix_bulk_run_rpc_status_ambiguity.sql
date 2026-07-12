-- Corrects the initial P0 function after the production migration was applied.
-- Fully-qualified aliases prevent RETURNS TABLE output names from shadowing columns.

create or replace function public.create_bulk_run(
  p_user_id uuid, p_source text, p_chunks jsonb, p_idempotency_key text,
  p_request_fingerprint text, p_policy_version integer default 1
) returns table(id uuid, replayed boolean, status text, total_contacts integer, chunk_count integer,
                reserved_credits integer, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $bulk_run_fix$
declare v_existing public.bulk_runs; v_total integer; v_remaining integer; v_run public.bulk_runs; v_chunk jsonb;
begin
  if p_user_id is null or p_source not in ('web','sheets','api') or p_idempotency_key !~ '^[A-Za-z0-9._-]{16,200}$'
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_chunks) <> 'array' then raise exception 'BULK_RUN_INVALID_INPUT'; end if;
  select * into v_existing from public.bulk_runs as existing_run where existing_run.user_id = p_user_id and existing_run.idempotency_key = p_idempotency_key for update;
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
    select 1 from (
      select lower(trim(email.value #>> '{}')) as email
      from jsonb_array_elements(p_chunks) as chunk(value)
      cross join lateral jsonb_array_elements(chunk.value->'contacts') as email(value)
    ) normalized group by email having count(*) > 1
  ) then raise exception 'BULK_RUN_DUPLICATE_CONTACT'; end if;
  select * into v_existing from public.bulk_runs as active_run where active_run.user_id = p_user_id and active_run.request_fingerprint = p_request_fingerprint and active_run.status in ('pending','processing','partial') for update;
  if found then raise exception 'ACTIVE_DUPLICATE_RUN:%', v_existing.id; end if;
  update public.profiles set credits_remaining = credits_remaining - v_total where profiles.id = p_user_id and profiles.credits_remaining >= v_total returning credits_remaining into v_remaining;
  if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into public.bulk_runs(user_id,source,idempotency_key,request_fingerprint,status,total_contacts,reserved_credits,policy_version)
    values(p_user_id,p_source,p_idempotency_key,p_request_fingerprint,'pending',v_total,v_total,p_policy_version) returning * into v_run;
  for v_chunk in select value from jsonb_array_elements(p_chunks) loop
    insert into public.bulk_run_chunks(run_id,user_id,chunk_index,idempotency_key,input_fingerprint,contact_count,contacts)
    values(v_run.id,p_user_id,(v_chunk->>'chunk_index')::integer,v_run.id::text || ':' || (v_chunk->>'chunk_index'),v_chunk->>'input_fingerprint',jsonb_array_length(v_chunk->'contacts'),v_chunk->'contacts');
  end loop;
  return query select v_run.id,false,v_run.status,v_run.total_contacts,jsonb_array_length(p_chunks),v_run.reserved_credits,v_run.created_at,v_run.expires_at;
end $bulk_run_fix$;

revoke all on function public.create_bulk_run(uuid,text,jsonb,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_bulk_run(uuid,text,jsonb,text,text,integer) to service_role;
