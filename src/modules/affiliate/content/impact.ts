export const FINANCIAL_CONTENT_TOKENS = ["commission", "reserve", "payout", "qualified sale", "refund", "chargeback"] as const;

export function checkContentImpact(previous: string, next: string) {
  const changed = FINANCIAL_CONTENT_TOKENS.filter((token) => previous.toLowerCase().includes(token) !== next.toLowerCase().includes(token));
  return Object.freeze({
    requiresRuleReview: changed.length > 0,
    requiresTelegramSync: previous !== next,
    changedFinancialTokens: Object.freeze(changed),
  });
}
