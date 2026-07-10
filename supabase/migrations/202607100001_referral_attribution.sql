create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'registered',
  source text not null default 'signup_ref',
  reward_status text not null default 'not_eligible_yet',
  first_paid_at timestamptz null,
  eligibility_review_at timestamptz null,
  reward_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_attributions_referrer_idx
  on public.referral_attributions(referrer_user_id, created_at desc);

create index if not exists referral_attributions_code_idx
  on public.referral_attributions(referral_code);

alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;

drop policy if exists "Users can read their own referral code" on public.referral_codes;
create policy "Users can read their own referral code"
on public.referral_codes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own referral code" on public.referral_codes;
create policy "Users can insert their own referral code"
on public.referral_codes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read referrals they made" on public.referral_attributions;
create policy "Users can read referrals they made"
on public.referral_attributions
for select
to authenticated
using ((select auth.uid()) = referrer_user_id);

drop policy if exists "Users can read their own attribution" on public.referral_attributions;
create policy "Users can read their own attribution"
on public.referral_attributions
for select
to authenticated
using ((select auth.uid()) = referred_user_id);
