-- Keep profile creation and the first free credit cycle in the same transaction.
create or replace function public.initialize_new_free_credit_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor timestamptz := coalesce(new.created_at, now());
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_fingerprint text;
begin
  if new.plan is distinct from 'free' then
    return new;
  end if;

  v_starts_at := public.credit_cycle_boundary(v_anchor, now(), false);
  v_expires_at := public.credit_cycle_boundary(v_anchor, now(), true);
  v_fingerprint := md5('free-profile:' || new.id::text || ':' || v_starts_at::text);

  perform public.grant_free_cycle_credits(
    new.id,
    v_anchor,
    v_starts_at,
    v_expires_at,
    v_fingerprint
  );
  return new;
end;
$$;

revoke all on function public.initialize_new_free_credit_cycle() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists initialize_new_free_credit_cycle on public.profiles;
create trigger initialize_new_free_credit_cycle
after insert on public.profiles
for each row
when (new.plan = 'free')
execute function public.initialize_new_free_credit_cycle();

-- Repair free profiles created after the ledger cutover without a current-cycle grant.
do $$
declare
  profile_row record;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
begin
  for profile_row in
    select profile.id, coalesce(profile.created_at, now()) as anchor_at
    from public.profiles profile
    where profile.plan = 'free'
  loop
    v_starts_at := public.credit_cycle_boundary(profile_row.anchor_at, now(), false);
    v_expires_at := public.credit_cycle_boundary(profile_row.anchor_at, now(), true);

    if not exists (
      select 1
      from public.credit_grants grant_row
      where grant_row.user_id = profile_row.id
        and grant_row.credit_type = 'contact_audit'
        and grant_row.source_type='free_cycle'
        and grant_row.starts_at = v_starts_at
    ) then
      perform public.grant_free_cycle_credits(
        profile_row.id,
        profile_row.anchor_at,
        v_starts_at,
        v_expires_at,
        md5('free-profile:' || profile_row.id::text || ':' || v_starts_at::text)
      );
    end if;
  end loop;

  if exists (
    select 1
    from public.profiles profile
    where profile.plan = 'free'
      and not exists (
        select 1
        from public.credit_grants grant_row
        where grant_row.user_id = profile.id
          and grant_row.credit_type = 'contact_audit'
          and grant_row.source_type='free_cycle'
          and grant_row.starts_at = public.credit_cycle_boundary(coalesce(profile.created_at, now()), now(), false)
      )
  ) then
    raise exception 'FREE_PROFILE_CREDIT_GRANT_MISSING';
  end if;
end;
$$;
