export type TelegramPublication = Readonly<{
  id: string;
  kind: "daily_content" | "qualified_sale" | "payout_notice" | "rule_change";
  affiliateId?: string;
  consent: boolean;
  alias?: string;
  saleQualified?: boolean;
  payoutPaid?: boolean;
  payoutReconciled?: boolean;
  contentStatus: "approved" | "published" | "draft" | "retired" | "rolled_back";
}>;

export function assertTelegramPublicationAllowed(item: TelegramPublication) {
  if (item.contentStatus !== "approved" && item.contentStatus !== "published") throw new Error("AFFILIATE_TELEGRAM_CONTENT_NOT_APPROVED");
  if (!item.consent && item.kind !== "daily_content" && item.kind !== "rule_change") throw new Error("AFFILIATE_TELEGRAM_CONSENT_REQUIRED");
  if (item.kind === "qualified_sale" && !item.saleQualified) throw new Error("AFFILIATE_TELEGRAM_SALE_NOT_QUALIFIED");
  if (item.kind === "payout_notice" && (!item.payoutPaid || !item.payoutReconciled)) throw new Error("AFFILIATE_TELEGRAM_PAYOUT_NOT_RECONCILED");
  return true;
}

export function telegramIdempotencyKey(item: TelegramPublication) {
  return `telegram:${item.kind}:${item.id}`;
}
