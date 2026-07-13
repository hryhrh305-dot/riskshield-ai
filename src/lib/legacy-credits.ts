import { consumeContactCredits, type ContactCreditReason } from "./credit-accounting";

const EMAIL_REGEX = /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i;

type SupabaseAdminLike = {
  from: (table: string) => any;
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: any; error: any }>;
};

export type LegacyCreditResult = {
  ok: boolean;
  requiredCredits: number;
  creditsAvailable: number;
  creditsRemaining: number;
  deducted: number;
  error?: "PROFILE_CREDIT_LOOKUP_FAILED" | "INSUFFICIENT_CREDITS" | "CONSUME_CREDIT_RPC_FAILED" | "CREDIT_DEDUCTION_NOT_CONFIRMED";
};

export function normalizeBillableEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!value || value.startsWith("#") || value.includes(" ")) return null;
  return EMAIL_REGEX.test(value) ? value : null;
}

export function getUniqueBillableEmails(input: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of input) {
    const normalized = normalizeBillableEmail(item);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

export function calculateRequiredCreditsFromEmails(input: string[]): number {
  return getUniqueBillableEmails(input).length;
}

export async function consumeLegacyCredits({
  supabase,
  userId,
  requiredCredits,
  requestId,
  reason,
  requestFingerprint,
}: {
  supabase: SupabaseAdminLike;
  userId: string;
  requiredCredits: number;
  requestId: string;
  reason: ContactCreditReason;
  requestFingerprint: unknown;
}): Promise<LegacyCreditResult> {
  const safeRequiredCredits = Number.isSafeInteger(requiredCredits)
    ? Math.max(0, requiredCredits)
    : 0;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single();

  if (profileError) {
    return {
      ok: false,
      requiredCredits: safeRequiredCredits,
      creditsAvailable: 0,
      creditsRemaining: 0,
      deducted: 0,
      error: "PROFILE_CREDIT_LOOKUP_FAILED",
    };
  }

  const creditsAvailable = Number.isFinite(profile?.credits_remaining)
    ? Number(profile.credits_remaining)
    : 0;

  if (safeRequiredCredits <= 0) {
    return {
      ok: true,
      requiredCredits: safeRequiredCredits,
      creditsAvailable,
      creditsRemaining: creditsAvailable,
      deducted: 0,
    };
  }

  if (creditsAvailable < safeRequiredCredits || creditsAvailable < 0) {
    return {
      ok: false,
      requiredCredits: safeRequiredCredits,
      creditsAvailable,
      creditsRemaining: creditsAvailable,
      deducted: 0,
      error: "INSUFFICIENT_CREDITS",
    };
  }

  const atomic = await consumeContactCredits({ supabase, userId, amount: safeRequiredCredits, reason, requestId, requestFingerprint });
  if (!atomic.ok) return {
    ok: false,
    requiredCredits: safeRequiredCredits,
    creditsAvailable,
    creditsRemaining: creditsAvailable,
    deducted: 0,
    error: atomic.error,
  };

  return {
    ok: true,
    requiredCredits: safeRequiredCredits,
    creditsAvailable: atomic.creditsAvailable,
    creditsRemaining: atomic.creditsRemaining,
    deducted: atomic.deducted,
  };
}
