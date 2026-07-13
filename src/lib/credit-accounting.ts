import { createHash } from "node:crypto";

export type CreditAccountingClient = {
  rpc: unknown;
};

type CreditRpc = (fn: string, params: Record<string, unknown>) => PromiseLike<{
  data: unknown;
  error: { message?: string } | null;
}>;

export type ContactCreditReason =
  | "web_audit"
  | "web_bulk_audit"
  | "api_audit"
  | "sheets_audit"
  | "pre_send_audit";

export function buildCreditRequestId(request: Request, scope: string): string {
  const supplied = request.headers.get("idempotency-key")?.trim();
  if (!supplied) return `${scope}:${crypto.randomUUID()}`;
  const normalized = /^[A-Za-z0-9._:-]{1,160}$/.test(supplied)
    ? supplied
    : createHash("sha256").update(supplied).digest("hex");
  return `${scope}:${normalized}`;
}

export async function consumeContactCredits({
  supabase,
  userId,
  amount,
  reason,
  requestId,
  requestFingerprint,
}: {
  supabase: CreditAccountingClient;
  userId: string;
  amount: number;
  reason: ContactCreditReason;
  requestId: string;
  requestFingerprint: unknown;
}) {
  const safeAmount = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
  if (safeAmount === 0) {
    return { ok: true as const, deducted: 0, creditsAvailable: 0, creditsRemaining: 0 };
  }
  if (!requestId.trim()) throw new Error("CREDIT_REQUEST_ID_REQUIRED");

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ creditType: "contact_audit", amount: safeAmount, reason, request: requestFingerprint }))
    .digest("hex");
  const rpc = (supabase.rpc as CreditRpc).bind(supabase);
  const { data, error } = await rpc("consume_grant_credits", {
    p_user_id: userId,
    p_credit_type: "contact_audit",
    p_amount: safeAmount,
    p_idempotency_key: requestId,
    p_fingerprint: fingerprint,
    p_context: { reason },
  });
  if (error) {
    const insufficient = String(error.message ?? error).includes("INSUFFICIENT_CREDITS");
    return {
      ok: false as const,
      deducted: 0,
      creditsAvailable: 0,
      creditsRemaining: 0,
      error: insufficient ? "INSUFFICIENT_CREDITS" as const : "CONSUME_CREDIT_RPC_FAILED" as const,
    };
  }
  const candidate = Array.isArray(data) ? data[0] : data;
  const value = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
  const deducted = Number(value?.deducted);
  const remaining = Number(value?.remaining);
  if (!Number.isSafeInteger(deducted) || deducted !== safeAmount
    || !Number.isSafeInteger(remaining) || remaining < 0) {
    return { ok: false as const, deducted: 0, creditsAvailable: 0, creditsRemaining: 0,
      error: "CONSUME_CREDIT_RPC_FAILED" as const };
  }
  return {
    ok: true as const,
    deducted,
    creditsAvailable: remaining + deducted,
    creditsRemaining: remaining,
  };
}

export async function getCreditSummary({ supabase, userId }: {
  supabase: CreditAccountingClient;
  userId: string;
}) {
  const rpc = (supabase.rpc as CreditRpc).bind(supabase);
  const { data, error } = await rpc("get_credit_summary", { p_user_id: userId });
  if (error) throw new Error("CREDIT_SUMMARY_FAILED");
  return Array.isArray(data) ? data[0] : data;
}
