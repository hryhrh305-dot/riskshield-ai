export interface RiskResponse {
  success: boolean;
  request_id: string;
  timestamp: string;
  processing_stage: "sync" | "async_pending" | "complete";
  input: { email?: string | null; ip?: string | null };
  result: { score: number; decision: "ALLOW" | "REVIEW" | "BLOCK"; reasons: string[]; checks_performed: number; checks_failed: number };
  details: { email?: Record<string, unknown> | null; ip?: Record<string, unknown> | null };
  ai_explanation?: { status: "pending" | "ready" | "unavailable"; text?: string; query_id?: string };
  rate_limit: { ip_remaining: number; daily_remaining: number; monthly_remaining: number };
}

export function createResponse(params: {
  score: number; reasons: string[]; email?: string | null; ip?: string | null;
  emailDetails?: Record<string, unknown> | null; ipDetails?: Record<string, unknown> | null;
  aiReason?: string; ipRemaining: number; dailyRemaining: number; monthlyRemaining: number;
}): RiskResponse {
  const decision = params.score >= 60 ? "BLOCK" : params.score >= 30 ? "REVIEW" : "ALLOW";
  return {
    success: true, request_id: crypto.randomUUID(), timestamp: new Date().toISOString(), processing_stage: "sync",
    input: { email: params.email ?? null, ip: params.ip ?? null },
    result: { score: params.score, decision, reasons: params.reasons, checks_performed: 10 + (params.email ? 8 : 0) + (params.ip ? 6 : 0), checks_failed: params.reasons.length },
    details: { email: params.emailDetails ?? null, ip: params.ipDetails ?? null },
    ai_explanation: params.aiReason ? { status: "ready", text: params.aiReason } : { status: "unavailable" },
    rate_limit: { ip_remaining: params.ipRemaining, daily_remaining: params.dailyRemaining, monthly_remaining: params.monthlyRemaining },
  };
}
