-- Affiliate operational state transitions. Additive only; Preview acceptance first.
begin;

alter table public.affiliate_attributions
  add column if not exists extension_used_at timestamptz,
  add column if not exists extension_days integer check (extension_days between 1 and 30),
  add column if not exists extended_by uuid;

create or replace function public.affiliate_submit_application_v2(
  p_user_id uuid,
  p_answers jsonb,
  p_policy_version text,
  p_quiz_version text,
  p_quiz_score integer,
  p_ip_hash text,
  p_user_agent_hash text,
  p_correlation_id text,
  p_request_id text,
  p_request_hash text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_key public.affiliate_idempotency_keys;
  v_application_id uuid;
begin
  if p_user_id is null or coalesce(btrim(p_request_id),'')='' or coalesce(btrim(p_request_hash),'')='' then
    raise exception 'AFFILIATE_APPLICATION_INVALID';
  end if;
  insert into public.affiliate_idempotency_keys(namespace,key,request_hash,expires_at)
  values('affiliate_application:'||p_user_id::text,p_request_id,p_request_hash,now()+interval '24 hours')
  on conflict do nothing;
  select * into v_key from public.affiliate_idempotency_keys
    where namespace='affiliate_application:'||p_user_id::text and key=p_request_id for update;
  if v_key.request_hash<>p_request_hash then raise exception 'AFFILIATE_IDEMPOTENCY_CONFLICT'; end if;
  if v_key.status='completed' then return v_key.response; end if;

  v_application_id:=public.affiliate_submit_application(
    p_user_id,p_answers,p_policy_version,p_quiz_version,p_quiz_score,
    p_ip_hash,p_user_agent_hash,p_correlation_id
  );
  update public.affiliate_idempotency_keys
    set status='completed',response=jsonb_build_object('applicationId',v_application_id,'replayed',false)
    where namespace='affiliate_application:'||p_user_id::text and key=p_request_id;
  return jsonb_build_object('applicationId',v_application_id,'replayed',false);
end $$;

create or replace function public.affiliate_record_activation_evidence(
  p_membership_id uuid,
  p_actor_id uuid,
  p_evidence_kind text,
  p_action_type text,
  p_format text,
  p_occurred_at timestamptz,
  p_evidence jsonb,
  p_idempotency_key text,
  p_correlation_id text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_member public.affiliate_memberships;
  v_action_count integer;
  v_format_count integer;
  v_shortcut text;
  v_approved boolean:=false;
begin
  if p_actor_id is null or p_occurred_at is null or coalesce(btrim(p_idempotency_key),'')='' or p_evidence_kind not in ('action','event') then
    raise exception 'AFFILIATE_ACTIVATION_EVIDENCE_INVALID';
  end if;
  select * into v_member from public.affiliate_memberships where id=p_membership_id and program_id='secwyn-india' for update;
  if not found or v_member.status<>'provisional' then raise exception 'AFFILIATE_PROVISIONAL_REQUIRED'; end if;

  if p_evidence_kind='action' then
    if coalesce(btrim(p_action_type),'')='' or coalesce(btrim(p_format),'')='' then raise exception 'AFFILIATE_ACTIVATION_ACTION_INVALID'; end if;
    insert into public.affiliate_activation_actions(membership_id,action_type,format,occurred_at,evidence,idempotency_key)
    values(p_membership_id,p_action_type,p_format,p_occurred_at,coalesce(p_evidence,'{}'::jsonb),p_idempotency_key)
    on conflict(idempotency_key) do nothing;
  else
    if p_action_type not in ('referred_registration','verified_opportunity','first_payment') then raise exception 'AFFILIATE_ACTIVATION_EVENT_INVALID'; end if;
    insert into public.affiliate_activation_events(membership_id,event_type,format,occurred_at,evidence,idempotency_key)
    values(p_membership_id,p_action_type,p_format,p_occurred_at,coalesce(p_evidence,'{}'::jsonb),p_idempotency_key)
    on conflict(idempotency_key) do nothing;
  end if;

  select count(distinct action_type),count(distinct format) into v_action_count,v_format_count
    from public.affiliate_activation_actions where membership_id=p_membership_id;
  select event_type into v_shortcut from public.affiliate_activation_events
    where membership_id=p_membership_id and event_type in ('first_payment','verified_opportunity','referred_registration')
    order by case event_type when 'first_payment' then 1 when 'verified_opportunity' then 2 else 3 end limit 1;

  if (v_action_count>=3 and v_format_count>=2) or v_shortcut is not null then
    update public.affiliate_memberships set status='approved',approved_at=coalesce(approved_at,now()),
      first_paid_at=case when v_shortcut='first_payment' then coalesce(first_paid_at,p_occurred_at) else first_paid_at end,
      updated_at=now() where id=p_membership_id;
    insert into public.affiliate_activation_events(membership_id,event_type,format,occurred_at,evidence,idempotency_key)
    values(p_membership_id,'approved',null,now(),jsonb_build_object('reason',coalesce(v_shortcut,'actions')),'activation-approved:'||p_membership_id)
    on conflict(idempotency_key) do nothing;
    v_approved:=true;
  end if;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,after_state,correlation_id)
  values(p_actor_id,'record_activation_evidence','affiliate_membership',p_membership_id::text,
    jsonb_build_object('approved',v_approved,'actionCount',v_action_count,'formatCount',v_format_count,'shortcut',v_shortcut),p_correlation_id);
  return jsonb_build_object('approved',v_approved,'actionCount',v_action_count,'formatCount',v_format_count,'shortcut',v_shortcut);
end $$;

create or replace function public.affiliate_request_activation_grace(
  p_membership_id uuid,p_actor_id uuid,p_reason text,p_correlation_id text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_member public.affiliate_memberships;
begin
  select * into v_member from public.affiliate_memberships where id=p_membership_id and program_id='secwyn-india' for update;
  if not found or v_member.status<>'provisional' then raise exception 'AFFILIATE_PROVISIONAL_REQUIRED'; end if;
  if v_member.grace_used_at is not null then raise exception 'AFFILIATE_GRACE_ALREADY_USED'; end if;
  if v_member.provisional_ends_at is null or v_member.provisional_ends_at>now() then raise exception 'AFFILIATE_GRACE_NOT_YET_AVAILABLE'; end if;
  update public.affiliate_memberships set grace_used_at=now(),provisional_ends_at=now()+interval '3 days',updated_at=now() where id=p_membership_id;
  insert into public.affiliate_activation_events(membership_id,event_type,occurred_at,evidence,idempotency_key)
  values(p_membership_id,'grace_started',now(),jsonb_build_object('reason',p_reason),'activation-grace:'||p_membership_id)
  on conflict(idempotency_key) do nothing;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,reason,correlation_id)
  values(p_actor_id,'grant_activation_grace','affiliate_membership',p_membership_id::text,p_reason,p_correlation_id);
  return jsonb_build_object('membershipId',p_membership_id,'graceEndsAt',now()+interval '3 days');
end $$;

create or replace function public.affiliate_extend_attribution_once(
  p_attribution_id uuid,p_actor_id uuid,p_days integer,p_reason text,p_correlation_id text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_attribution public.affiliate_attributions;
begin
  if p_days<1 or (p_days||' days')::interval>interval '30 days' or length(btrim(p_reason))<3 then raise exception 'AFFILIATE_EXTENSION_INVALID'; end if;
  if not exists(select 1 from public.affiliate_operator_roles where program_id='secwyn-india' and user_id=p_actor_id and revoked_at is null and role in ('program_manager','affiliate_admin','super_admin')) then
    raise exception 'AFFILIATE_OPERATOR_FORBIDDEN';
  end if;
  select * into v_attribution from public.affiliate_attributions where id=p_attribution_id and program_id='secwyn-india' for update;
  if not found then raise exception 'AFFILIATE_ATTRIBUTION_NOT_FOUND'; end if;
  if v_attribution.extension_used_at is not null then raise exception 'AFFILIATE_EXTENSION_ALREADY_USED'; end if;
  update public.affiliate_attributions set expires_at=expires_at+(p_days||' days')::interval,
    extension_used_at=now(),extension_days=p_days,extended_by=p_actor_id where id=p_attribution_id;
  insert into public.affiliate_audit_log(actor_id,action,object_type,object_id,reason,after_state,correlation_id)
  values(p_actor_id,'extend_attribution','affiliate_attribution',p_attribution_id::text,p_reason,jsonb_build_object('days',p_days),p_correlation_id);
  return jsonb_build_object('attributionId',p_attribution_id,'extensionDays',p_days);
end $$;

revoke all on function public.affiliate_submit_application_v2(uuid,jsonb,text,text,integer,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_record_activation_evidence(uuid,uuid,text,text,text,timestamptz,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_request_activation_grace(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.affiliate_extend_attribution_once(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.affiliate_submit_application_v2(uuid,jsonb,text,text,integer,text,text,text,text,text) to service_role;
grant execute on function public.affiliate_record_activation_evidence(uuid,uuid,text,text,text,timestamptz,jsonb,text,text) to service_role;
grant execute on function public.affiliate_request_activation_grace(uuid,uuid,text,text) to service_role;
grant execute on function public.affiliate_extend_attribution_once(uuid,uuid,integer,text,text) to service_role;

commit;
