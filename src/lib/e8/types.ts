export const PRODUCT_EVENT_NAMES = [
  "landing_page_loaded",
  "landing_view",
  "landing_session_started",
  "landing_engaged",
  "ses_click",
  "signup_viewed",
  "register_page_view",
  "onboarding_started",
  "onboarding_completed",
  "signup_started",
  "signup_completed",
  "signup_verification_pending",
  "email_verified",
  "pricing_viewed",
  "sample_audit_home_cta_clicked",
  "sample_audit_viewed",
  "sample_audit_primary_cta_clicked",
  "sample_audit_pricing_clicked",
  "homepage_sample_card_cta_clicked",
  "checkout_started",
  "contact_check_completed",
  "free_audit_started",
  "free_audit_completed",
  "report_viewed",
  "bulk_check_completed",
  "activation_completed",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export const SES_EVENT_NAMES = [
  "send", "delivery", "hard_bounce", "soft_bounce", "complaint", "reject",
  "delivery_delay", "open", "click", "unsubscribe", "unknown",
  "rendering_failure",
] as const;

export type SesEventName = (typeof SES_EVENT_NAMES)[number];
