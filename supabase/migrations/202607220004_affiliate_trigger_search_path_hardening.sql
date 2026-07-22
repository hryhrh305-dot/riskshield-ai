-- Fix the lookup path for Affiliate integrity triggers. Additive and behavior-preserving.
begin;

alter function public.affiliate_prevent_delete() set search_path=public;
alter function public.affiliate_prevent_mutation() set search_path=public;
alter function public.affiliate_protect_payout_item() set search_path=public;
alter function public.affiliate_protect_published_content() set search_path=public;
alter function public.affiliate_protect_terminal_sale() set search_path=public;

commit;
