alter table public.referral_attributions
  add column if not exists reward_plan text,
  add column if not exists reward_credits integer check (reward_credits is null or reward_credits > 0),
  add column if not exists reward_payment_id uuid references public.payments(id) on delete set null,
  add column if not exists reward_granted_at timestamptz;

create index if not exists referral_attributions_due_reward_idx
  on public.referral_attributions (referrer_user_id, eligibility_review_at)
  where reward_status = 'pending_review';

create index if not exists referral_attributions_reward_payment_idx
  on public.referral_attributions (reward_payment_id);

create or replace function public.issue_due_referral_reward(
  p_attribution_id uuid,
  p_referrer_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward integer;
begin
  select attribution.reward_credits
    into v_reward
  from public.referral_attributions as attribution
  where attribution.id = p_attribution_id
    and attribution.referrer_user_id = p_referrer_user_id
    and attribution.reward_status = 'pending_review'
    and attribution.eligibility_review_at <= now()
    and attribution.reward_credits > 0
    and exists (
      select 1
      from public.payments as payment
      where payment.id = attribution.reward_payment_id
        and payment.user_id = attribution.referred_user_id
        and payment.status = 'completed'
    )
    and exists (
      select 1
      from public.profiles as referred_profile
      where referred_profile.id = attribution.referred_user_id
        and referred_profile.subscription_status = 'active'
        and referred_profile.plan <> 'free'
    )
  for update;

  if v_reward is null then
    update public.referral_attributions
    set reward_status = 'disqualified',
        reward_notes = 'Referral was not eligible when the review period ended.',
        updated_at = now()
    where id = p_attribution_id
      and referrer_user_id = p_referrer_user_id
      and reward_status = 'pending_review'
      and eligibility_review_at <= now();
    return 0;
  end if;

  update public.referral_attributions
  set reward_status = 'issued',
      reward_granted_at = now(),
      reward_notes = 'Referral reward issued after eligibility review.',
      updated_at = now()
  where id = p_attribution_id
    and reward_status = 'pending_review';

  if not found then
    return 0;
  end if;

  update public.profiles
  set credits_remaining = credits_remaining + v_reward,
      updated_at = now()
  where id = p_referrer_user_id;

  if not found then
    raise exception 'REFERRER_PROFILE_NOT_FOUND';
  end if;

  return v_reward;
end;
$$;

revoke all on function public.issue_due_referral_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_due_referral_reward(uuid, uuid) to service_role;
