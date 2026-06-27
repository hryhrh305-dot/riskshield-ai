export const FREE_UPLOAD_MAX_CONTACTS = 500;
export const FREE_PREVIEW_AUDIT_CONTACTS = 30;
export const FREE_REPORT_LINK_EXPIRES_DAYS = 14;
export const FREE_UPLOAD_RAW_DATA_RETENTION_DAYS = 7;
export const FREE_REPORT_SUMMARY_RETENTION_DAYS = 14;

export const SMALL_REPORT_PRICE_USD = 19;
export const SMALL_REPORT_CONTACT_LIMIT = 120;

export const FOUNDER_STARTER_PRICE_USD = 49;
export const FOUNDER_STARTER_MONTHLY_CONTACTS = 500;
export const FOUNDER_STARTER_MONTHLY_REPORTS = 3;

export const TOPUP_EXPIRY_DAYS = 60;
export const CONTACT_TOPUP_100_PRICE_USD = 15;
export const CONTACT_TOPUP_250_PRICE_USD = 35;
export const CONTACT_TOPUP_500_PRICE_USD = 65;

export const EXTRA_REPORT_1_PRICE_USD = 15;
export const EXTRA_REPORT_3_PRICE_USD = 39;
export const EXTRA_REPORT_EXPIRY_DAYS = 60;

export const REFERRAL_REWARD_CONTACTS = 100;
export const REFERRAL_REWARD_DELAY_DAYS = 14;
export const REFERRAL_REWARD_EXPIRY_DAYS = 60;
export const REFERRAL_MONTHLY_REWARD_LIMIT = 5;
export const REFERRAL_MILESTONE_PAID_USERS = 3;
export const REFERRAL_MILESTONE_REPORT_CREDITS = 1;

export const API_MIN_PLAN = "growth" as const;
export const GOOGLE_SHEETS_MIN_PLAN = "growth" as const;

export const PAID_REPORT_AFTER_CANCEL_RETENTION_DAYS = 30;

export const RISKSHIELD_GROWTH_RULES = {
  freePreview: {
    uploadMaxContacts: FREE_UPLOAD_MAX_CONTACTS,
    previewAuditContacts: FREE_PREVIEW_AUDIT_CONTACTS,
    reportLinkExpiresDays: FREE_REPORT_LINK_EXPIRES_DAYS,
    rawDataRetentionDays: FREE_UPLOAD_RAW_DATA_RETENTION_DAYS,
    summaryRetentionDays: FREE_REPORT_SUMMARY_RETENTION_DAYS,
  },
  smallReport: {
    priceUsd: SMALL_REPORT_PRICE_USD,
    contactLimit: SMALL_REPORT_CONTACT_LIMIT,
  },
  founderStarter: {
    priceUsd: FOUNDER_STARTER_PRICE_USD,
    monthlyContacts: FOUNDER_STARTER_MONTHLY_CONTACTS,
    monthlyReports: FOUNDER_STARTER_MONTHLY_REPORTS,
  },
  topUps: {
    expiryDays: TOPUP_EXPIRY_DAYS,
    contacts100PriceUsd: CONTACT_TOPUP_100_PRICE_USD,
    contacts250PriceUsd: CONTACT_TOPUP_250_PRICE_USD,
    contacts500PriceUsd: CONTACT_TOPUP_500_PRICE_USD,
  },
  extraReports: {
    expiryDays: EXTRA_REPORT_EXPIRY_DAYS,
    report1PriceUsd: EXTRA_REPORT_1_PRICE_USD,
    report3PriceUsd: EXTRA_REPORT_3_PRICE_USD,
  },
  referral: {
    rewardContacts: REFERRAL_REWARD_CONTACTS,
    rewardDelayDays: REFERRAL_REWARD_DELAY_DAYS,
    rewardExpiryDays: REFERRAL_REWARD_EXPIRY_DAYS,
    monthlyRewardLimit: REFERRAL_MONTHLY_REWARD_LIMIT,
    milestonePaidUsers: REFERRAL_MILESTONE_PAID_USERS,
    milestoneReportCredits: REFERRAL_MILESTONE_REPORT_CREDITS,
  },
  gating: {
    apiMinPlan: API_MIN_PLAN,
    googleSheetsMinPlan: GOOGLE_SHEETS_MIN_PLAN,
  },
  retention: {
    paidReportAfterCancelDays: PAID_REPORT_AFTER_CANCEL_RETENTION_DAYS,
  },
} as const;

export type RiskShieldGrowthRules = typeof RISKSHIELD_GROWTH_RULES;
