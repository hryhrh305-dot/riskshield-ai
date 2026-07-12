import { createClient } from "@supabase/supabase-js";
import type { CreditSourceType, CreditType, CreditUsageReason } from "./credits-ledger";
import { calculateCreditSummary } from "./credits-ledger";

type ServiceClient = ReturnType<typeof createClient>;

let cachedAdmin: ServiceClient | null = null;

function getAdminClient(): ServiceClient | null {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !key) return null;

  cachedAdmin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdmin;
}

async function fetchCreditGrants(params: { userId: string; workspaceId?: string | null }) {
  const client = getAdminClient();
  if (!client) return [];

  let query = client
    .from("credit_grants")
    .select("*")
    .eq("user_id", params.userId);

  if (params.workspaceId == null) {
    query = query.is("workspace_id", null);
  } else {
    query = query.eq("workspace_id", params.workspaceId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}

function toGrantRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    workspaceId: row.workspace_id == null ? null : String(row.workspace_id),
    creditType: String(row.credit_type ?? "contact_audit") as CreditType,
    sourceType: String(row.source_type ?? "subscription") as CreditSourceType,
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    grantedAmount: Number(row.granted_amount ?? 0),
    remainingAmount: Number(row.remaining_amount ?? 0),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    expiresAt: row.expires_at == null ? null : String(row.expires_at),
    billingPeriodStart: row.billing_period_start == null ? null : String(row.billing_period_start),
    billingPeriodEnd: row.billing_period_end == null ? null : String(row.billing_period_end),
    status: String(row.status ?? "active") as "active" | "expired" | "consumed" | "revoked",
    createdAt: row.created_at == null ? null : String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

export async function getUserCreditSummaryFromLedger(params: {
  userId: string;
  workspaceId?: string | null;
}): Promise<unknown> {
  const rows = await fetchCreditGrants(params);
  const grants = rows.map(toGrantRow);
  return calculateCreditSummary(grants);
}

export async function consumeLedgerCredits(params: {
  userId: string;
  workspaceId?: string | null;
  creditType: CreditType;
  amount: number;
  usageReason: CreditUsageReason;
  relatedAuditId?: string | null;
  relatedReportId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const client = getAdminClient();
  if (!client) {
    return {
      ok: false,
      error: "Ledger service client is not configured.",
      requiredAmount: Math.max(0, Math.trunc(params.amount || 0)),
      availableAmount: 0,
    };
  }

  const { data, error } = await client.rpc("consume_ledger_credits", {
    p_user_id: params.userId,
    p_workspace_id: params.workspaceId ?? null,
    p_credit_type: params.creditType,
    p_amount: Math.trunc(params.amount || 0),
    p_usage_reason: params.usageReason,
    p_related_audit_id: params.relatedAuditId ?? null,
    p_related_report_id: params.relatedReportId ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Failed to consume ledger credits.",
      requiredAmount: Math.max(0, Math.trunc(params.amount || 0)),
      availableAmount: 0,
    };
  }

  return data;
}

export async function grantLedgerCredits(params: {
  userId: string;
  workspaceId?: string | null;
  creditType: CreditType;
  sourceType: "subscription" | "top_up" | "referral_bonus" | "small_report" | "manual_adjustment";
  sourceRef?: string | null;
  amount: number;
  expiresAt?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const client = getAdminClient();
  if (!client) {
    return { ok: false, error: "Ledger service client is not configured." };
  }

  const amount = Math.max(0, Math.trunc(params.amount || 0));
  const payload = {
    user_id: params.userId,
    workspace_id: params.workspaceId ?? null,
    credit_type: params.creditType,
    source_type: params.sourceType,
    source_ref: params.sourceRef ?? null,
    granted_amount: amount,
    remaining_amount: amount,
    starts_at: new Date().toISOString(),
    expires_at: params.expiresAt ?? null,
    billing_period_start: params.billingPeriodStart ?? null,
    billing_period_end: params.billingPeriodEnd ?? null,
    status: "active",
    metadata: params.metadata ?? {},
  };

  const { data, error } = await client.from("credit_grants").insert(payload).select("*").single();
  if (error) {
    return { ok: false, error: error.message || "Failed to grant ledger credits." };
  }

  return { ok: true, grant: data };
}

export async function expireOldLedgerCredits(params?: {
  now?: string;
}): Promise<unknown> {
  const client = getAdminClient();
  if (!client) {
    return { ok: false, error: "Ledger service client is not configured." };
  }

  const nowIso = params?.now ?? new Date().toISOString();
  const { data, error } = await client
    .from("credit_grants")
    .update({ status: "expired", updated_at: nowIso })
    .eq("status", "active")
    .lte("expires_at", nowIso)
    .select("id");

  if (error) {
    return { ok: false, error: error.message || "Failed to expire old ledger credits." };
  }

  return { ok: true, expiredCount: data?.length ?? 0 };
}
