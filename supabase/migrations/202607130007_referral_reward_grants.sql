-- Keep 004 immutable; replace its delivery function only after the ledger exists.
create or replace function public.issue_due_referral_reward(
  p_attribution_id uuid,p_referrer_user_id uuid
) returns integer language plpgsql security definer set search_path='' as $$
declare v_attribution public.referral_attributions; v_result jsonb; v_now timestamptz:=now();
begin
  select * into v_attribution from public.referral_attributions
    where id=p_attribution_id and referrer_user_id=p_referrer_user_id for update;
  if not found or v_attribution.reward_status<>'pending_review'
    or v_attribution.eligibility_review_at is null or v_attribution.eligibility_review_at>v_now then return 0; end if;
  perform 1 from public.payments where id=v_attribution.reward_payment_id for update;
  if v_attribution.reward_credits is null or v_attribution.reward_credits<=0
    or not exists(select 1 from public.payments where id=v_attribution.reward_payment_id
      and user_id=v_attribution.referred_user_id and status='completed')
    or not exists(select 1 from public.profiles where id=v_attribution.referred_user_id
      and subscription_status='active' and plan<>'free') then
    update public.referral_attributions set reward_status='disqualified',
      reward_notes='Referral was not eligible when the review period ended.',updated_at=v_now
      where id=p_attribution_id;
    return 0;
  end if;
  v_result:=public.grant_cycle_credits(p_referrer_user_id,'contact_audit','referral_bonus',
    'referral:'||p_attribution_id::text,v_attribution.reward_credits,v_now,v_now+interval '60 days',
    p_attribution_id::text,null,null,null,jsonb_build_object('attributionId',p_attribution_id,'plan',v_attribution.reward_plan));
  update public.referral_attributions set reward_status='issued',reward_granted_at=v_now,
    reward_notes='Referral reward issued after eligibility review; expires after 60 days.',updated_at=v_now
    where id=p_attribution_id;
  return v_attribution.reward_credits;
end $$;
revoke all on function public.issue_due_referral_reward(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_due_referral_reward(uuid,uuid) to service_role;
