export type Decision = "ALLOW" | "REVIEW" | "BLOCK";
export type MxEvidenceStatus = "present" | "absent" | "null_mx" | "lookup_failed" | "timed_out" | "not_tested";
export type MailboxEvidenceStatus = "confirmed" | "rejected" | "unconfirmed" | "not_tested";
export type CatchAllStatus = "yes" | "no" | "unknown" | "not_tested" | "lookup_failed";

export type ReconciledInputRow = {
  rowNumber: number;
  originalValue: string;
  normalizedValue: string | null;
  status: "ACCEPTED" | "REJECT_BEFORE_SCREENING" | "DUPLICATE";
  accepted: boolean;
  rejected: boolean;
  duplicate: boolean;
  processed: boolean;
  charged: boolean;
  rejectionReason: "INVALID_EMAIL_SYNTAX" | "DUPLICATE_NORMALIZED_EMAIL" | null;
};

export type InputReconciliation = {
  inputRows: number;
  syntaxAccepted: number;
  uniqueValidAddressesProcessed: number;
  rejectedBeforeScreening: number;
  duplicatesRemoved: number;
  resultsProduced: number;
  creditsConsumed: number;
  accepted: string[];
  rejected: ReconciledInputRow[];
  rows: ReconciledInputRow[];
};

const EMAIL_REGEX = /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/iu;
const RESERVED_EXACT_DOMAINS = new Set(["example.com", "example.net", "example.org", "localhost"]);
const RESERVED_SUFFIXES = [".invalid", ".test", ".localhost"];
const COMMON_PROVIDER_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",
  "hotnail.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "icloud.co": "icloud.com",
  "protonmail.co": "protonmail.com",
  "fastmai.com": "fastmail.com",
};

export function normalizeScreeningEmail(value: string): string | null {
  const trimmed = value.trim().replace(/^mailto:/iu, "").trim();
  if (!trimmed || trimmed.startsWith("#") || /\s/u.test(trimmed) || !EMAIL_REGEX.test(trimmed)) return null;
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  if (domain.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))) return null;
  return `${trimmed.slice(0, at).toLowerCase()}@${trimmed.slice(at + 1).toLowerCase()}`;
}

export function reconcileInputRows(values: string[]): InputReconciliation {
  const rows: ReconciledInputRow[] = [];
  const accepted: string[] = [];
  const rejected: ReconciledInputRow[] = [];
  const seen = new Set<string>();

  values.forEach((originalValue, index) => {
    const normalizedValue = normalizeScreeningEmail(originalValue);
    let status: ReconciledInputRow["status"] = "ACCEPTED";

    if (!normalizedValue) status = "REJECT_BEFORE_SCREENING";
    else if (seen.has(normalizedValue)) status = "DUPLICATE";

    const row: ReconciledInputRow = {
      rowNumber: index + 1,
      originalValue,
      normalizedValue,
      status,
      accepted: status === "ACCEPTED",
      rejected: status === "REJECT_BEFORE_SCREENING",
      duplicate: status === "DUPLICATE",
      processed: false,
      charged: false,
      rejectionReason: status === "REJECT_BEFORE_SCREENING"
        ? "INVALID_EMAIL_SYNTAX"
        : status === "DUPLICATE"
          ? "DUPLICATE_NORMALIZED_EMAIL"
          : null,
    };
    rows.push(row);
    if (status === "ACCEPTED" && normalizedValue) {
      seen.add(normalizedValue);
      accepted.push(normalizedValue);
    } else if (status === "REJECT_BEFORE_SCREENING") {
      rejected.push(row);
    }
  });

  return {
    inputRows: values.length,
    syntaxAccepted: rows.filter((row) => row.normalizedValue !== null).length,
    uniqueValidAddressesProcessed: accepted.length,
    rejectedBeforeScreening: rejected.length,
    duplicatesRemoved: rows.filter((row) => row.status === "DUPLICATE").length,
    resultsProduced: 0,
    creditsConsumed: 0,
    accepted,
    rejected,
    rows,
  };
}

export function finalizeInputReconciliation(
  reconciliation: InputReconciliation,
  outcome: { resultsProduced: number; creditsConsumed: number },
): InputReconciliation {
  const resultsProduced = Math.max(0, Math.min(reconciliation.accepted.length, Math.trunc(outcome.resultsProduced)));
  const creditsConsumed = Math.max(0, Math.min(reconciliation.accepted.length, Math.trunc(outcome.creditsConsumed)));
  let acceptedIndex = 0;
  const rows = reconciliation.rows.map((row) => {
    if (row.status !== "ACCEPTED") return { ...row, processed: false, charged: false };
    const index = acceptedIndex++;
    return { ...row, processed: index < resultsProduced, charged: index < creditsConsumed };
  });

  return {
    ...reconciliation,
    rows,
    uniqueValidAddressesProcessed: resultsProduced,
    resultsProduced,
    creditsConsumed,
  };
}

export function splitScreeningTextRows(text: string): string[] {
  const rows: string[] = [];
  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const commaSeparated = line.split(/[,;\t]+/u).map((part) => part.trim()).filter(Boolean);
    for (const part of commaSeparated) {
      rows.push(part.replace(/^[\uFEFF'"<({\[]+|['">)}\]]+$/gu, ""));
    }
  }
  return rows;
}

export function isReservedOrTestDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  return RESERVED_EXACT_DOMAINS.has(normalized) || RESERVED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function suggestEmailDomainCorrection(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const replacement = COMMON_PROVIDER_TYPOS[email.slice(at + 1).toLowerCase()];
  return replacement ? `${email.slice(0, at)}@${replacement}` : null;
}

export function classifyMxEvidence({
  records,
  errorCode,
}: {
  records?: Array<{ exchange?: string } | string>;
  errorCode?: string | null;
}): MxEvidenceStatus {
  if (records?.some((record) => {
    const exchange = typeof record === "string" ? record : record.exchange || "";
    return exchange.trim() === ".";
  })) return "null_mx";
  if (records && records.length > 0) return "present";

  const code = (errorCode || "").toUpperCase();
  if (code.includes("TIMEOUT") || code === "ETIMEOUT") return "timed_out";
  if (["ENODATA", "ENOTFOUND", "ENONAME", "NXDOMAIN"].some((value) => code.includes(value))) return "absent";
  if (code) return "lookup_failed";
  return records ? "absent" : "not_tested";
}

function scoreDecision(score: number): Decision {
  return score >= 66 ? "BLOCK" : score >= 26 ? "REVIEW" : "ALLOW";
}

function domainFromEmail(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function applyDecisionIntegrity(input: {
  email: string;
  score: number;
  decision?: Decision;
  isDisposable?: boolean;
  mxStatus?: MxEvidenceStatus;
  mailboxStatus?: MailboxEvidenceStatus;
  catchAllStatus?: CatchAllStatus;
}) {
  const domain = domainFromEmail(input.email);
  const suggestedEmail = suggestEmailDomainCorrection(input.email);
  const baseDecision = scoreDecision(input.score);
  let decision: Decision = input.decision || baseDecision;
  let primaryReason = decision === "ALLOW" ? "No blocking signal detected" : decision === "REVIEW" ? "Manual review required" : "High-risk signal detected";
  let primaryReasonCode = decision === "ALLOW" ? "BASE_SCORE_ALLOW" : decision === "REVIEW" ? "BASE_SCORE_REVIEW" : "BASE_SCORE_BLOCK";
  let recommendedAction = decision === "ALLOW" ? "Send" : decision === "REVIEW" ? "Review identity" : "Suppress";
  let confidence: "high" | "medium" | "low" = "medium";

  if (suggestedEmail) {
    decision = "BLOCK";
    primaryReasonCode = "POSSIBLE_TYPO";
    primaryReason = "Possible domain typo";
    recommendedAction = `Correct typo to ${suggestedEmail}`;
    confidence = "high";
  } else if (input.isDisposable) {
    decision = "BLOCK";
    primaryReasonCode = "DISPOSABLE_DOMAIN";
    primaryReason = "Disposable mailbox";
    recommendedAction = "Suppress";
    confidence = "high";
  } else if (isReservedOrTestDomain(domain)) {
    decision = "BLOCK";
    primaryReasonCode = "RESERVED_TEST_DOMAIN";
    primaryReason = "Reserved or test domain";
    recommendedAction = "Replace contact";
    confidence = "high";
  } else if (input.mxStatus === "null_mx") {
    decision = "BLOCK";
    primaryReasonCode = "NULL_MX";
    primaryReason = "Domain explicitly does not accept mail";
    recommendedAction = "Suppress";
    confidence = "high";
  } else if (input.mxStatus === "absent") {
    decision = "BLOCK";
    primaryReasonCode = "NO_MX";
    primaryReason = suggestedEmail ? "Possible domain typo" : "No usable MX";
    recommendedAction = suggestedEmail ? `Correct typo to ${suggestedEmail}` : "Correct typo or replace contact";
    confidence = "high";
  } else if (input.mailboxStatus === "rejected") {
    decision = "BLOCK";
    primaryReasonCode = "SMTP_FAILURE";
    primaryReason = "Mailbox rejected";
    recommendedAction = "Correct typo or replace contact";
    confidence = "high";
  } else if (input.mxStatus === "lookup_failed" || input.mxStatus === "timed_out") {
    decision = "REVIEW";
    primaryReasonCode = "MX_LOOKUP_FAILED";
    primaryReason = input.mxStatus === "timed_out" ? "MX lookup timed out" : "MX lookup failed";
    recommendedAction = "Retry later";
    confidence = "low";
  } else if (input.catchAllStatus === "yes") {
    decision = "REVIEW";
    primaryReasonCode = "CATCH_ALL_DOMAIN";
    primaryReason = "Catch-all mailbox uncertainty";
    recommendedAction = "Verify the individual mailbox before sending";
    confidence = "low";
  } else if (!input.mxStatus || input.mxStatus === "not_tested" || !input.mailboxStatus || input.mailboxStatus === "unconfirmed" || input.mailboxStatus === "not_tested") {
    decision = "REVIEW";
    primaryReasonCode = "MAILBOX_UNCONFIRMED";
    primaryReason = "Mailbox unconfirmed";
    recommendedAction = "Review identity";
    confidence = "low";
  } else {
    decision = baseDecision;
  }

  if (baseDecision === "BLOCK" && decision === "REVIEW") {
    decision = "BLOCK";
    primaryReasonCode = "BASE_SCORE_BLOCK";
    primaryReason = "High-risk base signal score";
    recommendedAction = "Suppress";
    confidence = "medium";
  }

  const mailboxConfirmed = input.mailboxStatus === "confirmed";
  const inboxProbability = mailboxConfirmed ? "confirmed" : input.mailboxStatus === "rejected" ? "none" : "unknown";
  const estimatedBounceRate = mailboxConfirmed ? "not estimated" : input.mailboxStatus === "rejected" ? "high" : "unknown";
  const limitation = mailboxConfirmed
    ? "Mailbox-level evidence was returned by the recipient server."
    : "Domain evidence does not confirm that this individual mailbox exists.";
  const recommendation = decision === "ALLOW"
    ? "Send"
    : decision === "REVIEW"
      ? `${recommendedAction}. ${limitation}`
      : recommendedAction;

  return {
    decision,
    queue: decision === "ALLOW" ? "send" as const : decision === "REVIEW" ? "review" as const : "suppress" as const,
    primaryReason,
    primaryReasonCode,
    recommendedAction,
    confidence,
    limitation,
    recommendation,
    inboxProbability,
    estimatedBounceRate,
    catchAllStatus: input.catchAllStatus || "unknown" as CatchAllStatus,
    decisionExplanation: `${decision}: ${primaryReason}. ${limitation}`,
    suggestedEmail,
  };
}

export function getPlanAuditCta(plan: string): { label: string; href: string } {
  switch (plan.toLowerCase()) {
    case "free": return { label: "Upgrade to Starter", href: "/pricing" };
    case "starter": return { label: "View Growth features", href: "/pricing" };
    case "growth": return { label: "View Scale features", href: "/pricing" };
    case "scale": return { label: "Contact support / Business", href: "mailto:support@secwyn.com" };
    case "business": return { label: "Run another audit", href: "/bulk-check" };
    default: return { label: "View plans", href: "/pricing" };
  }
}

export function statusLabel(value: unknown, unknownLabel = "Unknown"): string {
  if (value === true || value === "yes") return "Yes";
  if (value === false || value === "no") return "No";
  if (value === "lookup_failed") return "Lookup failed";
  if (value === "timed_out") return "Timed out";
  if (value === "not_tested") return "Not tested";
  if (value === "present") return "Present";
  if (value === "absent") return "Missing";
  if (value === "null_mx") return "Does not accept mail";
  if (value === "confirmed") return "Confirmed";
  if (value === "unconfirmed") return "Unconfirmed";
  return unknownLabel;
}

export function sanitizeDecisionText(value: string): string {
  return value.replace(/\s*\?\s*/g, " - ").replace(/\s+/g, " ").trim();
}
