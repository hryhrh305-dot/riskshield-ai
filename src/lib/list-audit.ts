export type AuditQueue = "send" | "review" | "suppress";

export type LaunchStatus =
  | "ready_to_launch"
  | "launch_with_caution"
  | "do_not_launch";

export type ListAcceptance =
  | "accept_as_is"
  | "accept_after_cleanup"
  | "needs_enrichment"
  | "reject_do_not_send";

export type AuditSeverity = "low" | "medium" | "high" | "positive";

export type AuditEvidence = {
  signal: string;
  severity: AuditSeverity;
  explanation: string;
};

export type ContactAuditDecision = {
  email: string;
  normalizedEmail: string;
  decision: string;
  queue: AuditQueue;
  legacyDecision?: string;
  riskScore?: number;
  confidence: number;
  reasonCodes: string[];
  primaryReason: string;
  recommendedAction: string;
  businessImpact: string;
  evidence: AuditEvidence[];
};

export type ListAuditSummary = {
  total: number;
  sendCount: number;
  reviewCount: number;
  suppressCount: number;
  sendRate: number;
  reviewRate: number;
  suppressRate: number;
  campaignReadinessScore: number;
  launchStatus: LaunchStatus;
  listAcceptance: ListAcceptance;
  topRiskReasons: Array<{
    reasonCode: string;
    count: number;
    label: string;
  }>;
  estimatedWastePrevented: {
    riskySendsPrevented: number;
    estimatedSendingCreditsSaved: number;
    estimatedSdrTimeSavedHours: number;
    estimatedWasteSavedUsd: number;
  };
  recommendedWorkflow: string[];
  clientRiskBrief: string;
};

export type AuditReasonLabel = {
  code: string;
  label: string;
  severity: AuditSeverity;
};

export const DEFAULT_SENDING_COST_PER_RISKY_SEND_USD = 0.05;
export const DEFAULT_SDR_MINUTES_SAVED_PER_SUPPRESS_CONTACT = 1.5;
export const DEFAULT_SDR_HOURLY_COST_USD = 30;

const AUDIT_REASON_LABELS: Record<string, AuditReasonLabel> = {
  INVALID_SYNTAX: { code: "INVALID_SYNTAX", label: "Invalid email syntax", severity: "high" },
  DISPOSABLE_DOMAIN: { code: "DISPOSABLE_DOMAIN", label: "Disposable or temporary domain", severity: "high" },
  ROLE_BASED_EMAIL: { code: "ROLE_BASED_EMAIL", label: "Role-based inbox", severity: "medium" },
  NO_MX: { code: "NO_MX", label: "No valid mail server", severity: "high" },
  FREE_EMAIL_PROVIDER: { code: "FREE_EMAIL_PROVIDER", label: "Free email provider", severity: "medium" },
  SUSPICIOUS_LOCAL_PART: { code: "SUSPICIOUS_LOCAL_PART", label: "Suspicious mailbox pattern", severity: "medium" },
  LOW_CONFIDENCE: { code: "LOW_CONFIDENCE", label: "Low confidence result", severity: "medium" },
  CATCH_ALL_DOMAIN: { code: "CATCH_ALL_DOMAIN", label: "Catch-all domain", severity: "medium" },
  DOMAIN_TOO_NEW: { code: "DOMAIN_TOO_NEW", label: "Very new domain", severity: "medium" },
  BLACKLIST_HIT: { code: "BLACKLIST_HIT", label: "Known blacklist hit", severity: "high" },
  SMTP_FAILURE: { code: "SMTP_FAILURE", label: "SMTP validation failure", severity: "high" },
  PROXY_OR_VPN: { code: "PROXY_OR_VPN", label: "Proxy or VPN source", severity: "medium" },
  DATACENTER_IP: { code: "DATACENTER_IP", label: "Datacenter or hosting IP", severity: "medium" },
  HIGH_RISK_COUNTRY: { code: "HIGH_RISK_COUNTRY", label: "High-risk country", severity: "medium" },
  DOMAIN_AUTH_WEAK: { code: "DOMAIN_AUTH_WEAK", label: "Weak domain authentication", severity: "low" },
  MX_PRESENT: { code: "MX_PRESENT", label: "Mail server present", severity: "positive" },
  SPF_PRESENT: { code: "SPF_PRESENT", label: "SPF configured", severity: "positive" },
  DMARC_PRESENT: { code: "DMARC_PRESENT", label: "DMARC configured", severity: "positive" },
  DKIM_PRESENT: { code: "DKIM_PRESENT", label: "DKIM configured", severity: "positive" },
  DOMAIN_ESTABLISHED: { code: "DOMAIN_ESTABLISHED", label: "Established domain age", severity: "positive" },
  PERSONAL_EMAIL_PATTERN: { code: "PERSONAL_EMAIL_PATTERN", label: "Personal email pattern", severity: "positive" },
  UNKNOWN_RISK: { code: "UNKNOWN_RISK", label: "Uncertain risk signal", severity: "low" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(" | ");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function inferReasonCodeFromText(raw: string): string {
  const text = raw.toLowerCase();

  if (
    text.includes("invalid email format") ||
    text.includes("invalid syntax") ||
    text.includes("bad syntax") ||
    text.includes("malformed email") ||
    text.includes("email format")
  ) return "INVALID_SYNTAX";

  if (
    text.includes("disposable") ||
    text.includes("temporary") ||
    text.includes("throwaway") ||
    text.includes("fake/temporary") ||
    text.includes("temporary registration")
  ) return "DISPOSABLE_DOMAIN";

  if (
    text.includes("role-based") ||
    text.includes("shared inbox") ||
    text.includes("generic inbox") ||
    text.includes("not a personal address") ||
    text.includes("info@") ||
    text.includes("sales@") ||
    text.includes("support@")
  ) return "ROLE_BASED_EMAIL";

  if (
    text.includes("no mx") ||
    text.includes("no mail server") ||
    text.includes("mailbox does not exist") ||
    text.includes("cannot receive email") ||
    text.includes("guaranteed bounce") ||
    text.includes("domain cannot receive email")
  ) return "NO_MX";

  if (
    text.includes("gmail") ||
    text.includes("outlook") ||
    text.includes("yahoo") ||
    text.includes("hotmail") ||
    text.includes("free email provider") ||
    text.includes("freemail")
  ) return "FREE_EMAIL_PROVIDER";

  if (
    text.includes("suspicious local-part") ||
    text.includes("auto-generated") ||
    text.includes("numeric local part") ||
    text.includes("gibberish") ||
    text.includes("looks auto-generated")
  ) return "SUSPICIOUS_LOCAL_PART";

  if (
    text.includes("low confidence") ||
    text.includes("uncertain") ||
    text.includes("limited data") ||
    text.includes("could not verify")
  ) return "LOW_CONFIDENCE";

  if (
    text.includes("catch-all") ||
    text.includes("accepts all emails")
  ) return "CATCH_ALL_DOMAIN";

  if (
    text.includes("blacklist") ||
    text.includes("abuse") ||
    text.includes("flagged from previous abuse")
  ) return "BLACKLIST_HIT";

  if (
    text.includes("smtp permanent rejection") ||
    text.includes("smtp validation failed") ||
    text.includes("mailbox rejected") ||
    text.includes("temporarily rejecting emails") ||
    text.includes("permanently rejected")
  ) return "SMTP_FAILURE";

  if (text.includes("proxy") || text.includes("vpn")) return "PROXY_OR_VPN";
  if (text.includes("datacenter") || text.includes("hosting ip")) return "DATACENTER_IP";
  if (text.includes("high-risk country") || text.includes("higher risk country")) return "HIGH_RISK_COUNTRY";
  if (text.includes("less than 90 days") || text.includes("new registration") || text.includes("very new")) return "DOMAIN_TOO_NEW";
  if (
    text.includes("missing spf") ||
    text.includes("missing dmarc") ||
    text.includes("missing dkim") ||
    text.includes("lacks sender authentication") ||
    text.includes("vulnerable to spoofing")
  ) return "DOMAIN_AUTH_WEAK";

  if (
    text.includes("mx records present") ||
    text.includes("valid mx records") ||
    text.includes("mail server configured")
  ) return "MX_PRESENT";

  if (text.includes("spf record present") || text.includes("spf enabled")) return "SPF_PRESENT";
  if (text.includes("dmarc record present") || text.includes("dmarc enabled")) return "DMARC_PRESENT";
  if (text.includes("dkim record present") || text.includes("dkim enabled")) return "DKIM_PRESENT";
  if (text.includes("domain older than 1 year") || text.includes("established domain")) return "DOMAIN_ESTABLISHED";
  if (text.includes("personal/individual email pattern") || text.includes("higher trust signal")) return "PERSONAL_EMAIL_PATTERN";

  return "UNKNOWN_RISK";
}

function normalizeReasonCodes(rawReasons: string[]): string[] {
  const codes = rawReasons.map((reason) => inferReasonCodeFromText(reason));
  return [...new Set(codes)];
}

function getReasonLabel(code: string): AuditReasonLabel {
  return AUDIT_REASON_LABELS[code] ?? { code, label: code.replace(/_/g, " ").toLowerCase(), severity: "low" };
}

export function normalizeAuditQueue(input?: string | null): AuditQueue {
  const value = (input || "").toString().trim().toLowerCase();

  if (
    value === "send" ||
    value === "allow" ||
    value === "accepted" ||
    value === "accept_as_is" ||
    value === "ready_to_launch"
  ) return "send";

  if (
    value === "review" ||
    value === "caution" ||
    value === "warning" ||
    value === "launch_with_caution" ||
    value === "accept_after_cleanup" ||
    value === "needs_enrichment" ||
    value === "low_confidence"
  ) return "review";

  if (
    value === "suppress" ||
    value === "block" ||
    value === "deny" ||
    value === "reject" ||
    value === "do_not_send" ||
    value === "do_not_launch" ||
    value === "blocked"
  ) return "suppress";

  return "review";
}

function readDetailsField(details: Record<string, unknown> | null | undefined, key: string): unknown {
  return details && details[key] !== undefined ? details[key] : undefined;
}

function addEvidence(
  evidence: AuditEvidence[],
  seen: Set<string>,
  signal: string,
  severity: AuditSeverity,
  explanation: string,
) {
  if (seen.has(signal)) return;
  seen.add(signal);
  evidence.push({ signal, severity, explanation });
}

function inferEvidenceFromReason(reason: string): AuditEvidence | null {
  const code = inferReasonCodeFromText(reason);
  const meta = getReasonLabel(code);
  if (meta.code === "UNKNOWN_RISK") return null;
  return {
    signal: meta.code,
    severity: meta.severity,
    explanation: reason,
  };
}

function buildEvidenceFromRawInput(input: Record<string, unknown>, queue: AuditQueue, reasonCodes: string[]): AuditEvidence[] {
  const evidence: AuditEvidence[] = [];
  const seen = new Set<string>();
  const rawReasons = [
    ...(Array.isArray(input.reasons) ? input.reasons.map(String) : []),
    ...(Array.isArray(input.risk_factors) ? input.risk_factors.map(String) : []),
    ...(Array.isArray(input.impact) ? input.impact.map(String) : []),
    ...(Array.isArray(input.solution) ? input.solution.map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return [record.category, record.problem, record.fix].map(toText).filter(Boolean).join(": ");
    }) : []),
  ].filter(Boolean);

  for (const reason of rawReasons) {
    const inferred = inferEvidenceFromReason(reason);
    if (inferred) {
      addEvidence(evidence, seen, inferred.signal, inferred.severity, inferred.explanation);
    }
  }

  const details = (input.details as { email?: Record<string, unknown> | null; ip?: Record<string, unknown> | null } | undefined) || undefined;
  const emailDetails = details?.email ?? null;
  const ipDetails = details?.ip ?? null;

  const isDisposable = !!readDetailsField(emailDetails, "isDisposable");
  const isRoleBased = !!readDetailsField(emailDetails, "isRoleBased");
  const hasMX = readDetailsField(emailDetails, "hasMX");
  const mxChecked = !!readDetailsField(emailDetails, "mxChecked");
  const hasSPF = readDetailsField(emailDetails, "hasSPF");
  const spfChecked = !!readDetailsField(emailDetails, "spfChecked");
  const hasDMARC = readDetailsField(emailDetails, "hasDMARC");
  const dmarcChecked = !!readDetailsField(emailDetails, "dmarcChecked");
  const hasDKIM = readDetailsField(emailDetails, "hasDKIM");
  const dkimChecked = !!readDetailsField(emailDetails, "dkimChecked");
  const isCatchAll = !!readDetailsField(emailDetails, "isCatchAll") || !!readDetailsField(emailDetails, "catchAllDetected");
  const smtpChecked = !!readDetailsField(emailDetails, "smtpChecked");
  const smtpValid = readDetailsField(emailDetails, "smtpValid");
  const permanentRejected = !!readDetailsField(emailDetails, "permanentRejected");
  const tempRejected = !!readDetailsField(emailDetails, "tempRejected");
  const mailboxFull = !!readDetailsField(emailDetails, "mailboxFull");

  if (isDisposable) addEvidence(evidence, seen, "DISPOSABLE_DOMAIN", "high", "Disposable or temporary domain detected.");
  if (isRoleBased) addEvidence(evidence, seen, "ROLE_BASED_EMAIL", "medium", "Role-based inbox detected.");
  if (hasMX === false && mxChecked) addEvidence(evidence, seen, "NO_MX", "high", "No valid mail server was found.");
  if (hasMX === true && mxChecked) addEvidence(evidence, seen, "MX_PRESENT", "positive", "Mail server present.");
  if (hasSPF === true && spfChecked) addEvidence(evidence, seen, "SPF_PRESENT", "positive", "SPF is configured.");
  if (hasDMARC === true && dmarcChecked) addEvidence(evidence, seen, "DMARC_PRESENT", "positive", "DMARC is configured.");
  if (hasDKIM === true && dkimChecked) addEvidence(evidence, seen, "DKIM_PRESENT", "positive", "DKIM is configured.");
  if (isCatchAll) addEvidence(evidence, seen, "CATCH_ALL_DOMAIN", "medium", "Catch-all domain detected.");
  if (smtpChecked && smtpValid === false) addEvidence(evidence, seen, "SMTP_FAILURE", "high", "SMTP validation failed.");
  if (permanentRejected) addEvidence(evidence, seen, "SMTP_FAILURE", "high", "SMTP permanently rejected this mailbox.");
  if (tempRejected) addEvidence(evidence, seen, "SMTP_FAILURE", "medium", "SMTP temporarily rejected this mailbox.");
  if (mailboxFull) addEvidence(evidence, seen, "SMTP_FAILURE", "medium", "Mailbox is full.");

  const ipProxy = !!readDetailsField(ipDetails, "isProxy") || !!readDetailsField(ipDetails, "proxy");
  const ipHosting = !!readDetailsField(ipDetails, "isHosting") || !!readDetailsField(ipDetails, "hosting");
  const ipCountryCode = String(readDetailsField(ipDetails, "countryCode") || "").toUpperCase();
  const highRiskCountries = new Set(["NG", "RU", "IR", "KP", "BY", "VE", "UA", "SY", "SD", "CU", "PK", "KH", "BD"]);
  if (ipProxy) addEvidence(evidence, seen, "PROXY_OR_VPN", "medium", "Proxy or VPN source detected.");
  if (ipHosting) addEvidence(evidence, seen, "DATACENTER_IP", "medium", "Datacenter or hosting IP detected.");
  if (highRiskCountries.has(ipCountryCode)) addEvidence(evidence, seen, "HIGH_RISK_COUNTRY", "medium", "Source country is higher risk.");

  const domainAge = readDetailsField(input, "domain_age");
  if (typeof domainAge === "object" && domainAge) {
    const ageDays = Number((domainAge as Record<string, unknown>).ageDays);
    if (!Number.isNaN(ageDays) && ageDays >= 365) {
      addEvidence(evidence, seen, "DOMAIN_ESTABLISHED", "positive", "Domain is older than one year.");
    } else if (!Number.isNaN(ageDays) && ageDays > 0 && ageDays < 90) {
      addEvidence(evidence, seen, "DOMAIN_TOO_NEW", "medium", "Domain is very new.");
    }
  }

  if (reasonCodes.length === 0 && evidence.length === 0) {
    addEvidence(evidence, seen, "UNKNOWN_RISK", "low", "No strong signal was extracted from the legacy result.");
  }

  // Keep a small queue-specific hint in evidence for downstream UX.
  if (queue === "send") {
    addEvidence(evidence, seen, "PERSONAL_EMAIL_PATTERN", "positive", "Safe-to-send segment.");
  } else if (queue === "review") {
    addEvidence(evidence, seen, "LOW_CONFIDENCE", "medium", "Review before launch.");
  }

  return evidence;
}

function choosePrimaryReason(evidence: AuditEvidence[], reasonCodes: string[], queue: AuditQueue): string {
  const ranked = evidence
    .filter((item) => item.severity !== "positive")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  if (ranked.length > 0) {
    return getReasonLabel(ranked[0].signal).label;
  }

  if (reasonCodes.length > 0) {
    return getReasonLabel(reasonCodes[0]).label;
  }

  return queue === "send" ? "Ready for launch" : queue === "review" ? "Review before launch" : "Do not send";
}

function severityRank(severity: AuditSeverity): number {
  switch (severity) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    case "positive": return 0;
  }
}

function buildRecommendedAction(queue: AuditQueue, primaryReason: string): string {
  if (queue === "send") {
    return `Export the Send segment to your campaign. ${primaryReason ? `Primary signal: ${primaryReason}.` : ""}`.trim();
  }
  if (queue === "review") {
    return `Review this contact before launch. ${primaryReason ? `Primary signal: ${primaryReason}.` : ""}`.trim();
  }
  return `Suppress this contact from the outbound list. ${primaryReason ? `Primary signal: ${primaryReason}.` : ""}`.trim();
}

function buildBusinessImpact(queue: AuditQueue, primaryReason: string): string {
  if (queue === "send") return "Low expected waste; suitable for controlled outreach.";
  if (queue === "review") return "Potential deliverability or response-quality risk; inspect before launch.";
  if (primaryReason.includes("Disposable") || primaryReason.includes("No valid mail server")) {
    return "High waste risk if included in the launch list.";
  }
  return "Likely wasted send or reputational risk; exclude from the campaign.";
}

function computeConfidence({
  queue,
  evidence,
  riskScore,
}: {
  queue: AuditQueue;
  evidence: AuditEvidence[];
  riskScore: number;
}): number {
  const riskSignals = evidence.filter((item) => item.severity === "high" || item.severity === "medium").length;
  const positiveSignals = evidence.filter((item) => item.severity === "positive").length;
  let confidence = 35 + riskSignals * 12 + positiveSignals * 5;

  if (queue === "suppress") confidence += 10;
  if (queue === "send" && positiveSignals >= 2) confidence += 10;
  if (riskScore >= 75) confidence += 10;
  if (riskScore < 20) confidence -= 5;
  if (evidence.some((item) => item.signal === "LOW_CONFIDENCE" || item.signal === "UNKNOWN_RISK")) confidence -= 10;

  return clamp(Math.round(confidence), 0, 100);
}

export function buildContactAuditDecision(input: Record<string, unknown>): ContactAuditDecision {
  const email = String(input.email || input.normalizedEmail || "").trim();
  const normalizedEmail = String(input.normalizedEmail || email).trim().toLowerCase();
  const legacyDecision = String(
    input.decision ||
    input.risk_level ||
    input.status ||
    input.launch_status ||
    "",
  ).trim();
  const queue = normalizeAuditQueue(legacyDecision);
  const riskScore = Number(input.riskScore ?? input.risk_score ?? input.score ?? 0) || 0;

  const rawReasonTexts = [
    ...(Array.isArray(input.reasons) ? input.reasons.map(toText) : []),
    ...(Array.isArray(input.risk_factors) ? input.risk_factors.map(toText) : []),
    ...(Array.isArray(input.impact) ? input.impact.map(toText) : []),
  ].filter(Boolean);
  const reasonCodes = [...new Set([
    ...normalizeReasonCodes(rawReasonTexts),
    ...(queue === "send" ? ["PERSONAL_EMAIL_PATTERN"] : []),
  ])];

  const evidence = buildEvidenceFromRawInput(input, queue, reasonCodes);
  const primaryReason = choosePrimaryReason(evidence, reasonCodes, queue);
  const recommendedAction = buildRecommendedAction(queue, primaryReason);
  const businessImpact = buildBusinessImpact(queue, primaryReason);
  const confidence = computeConfidence({ queue, evidence, riskScore });

  return {
    email,
    normalizedEmail,
    decision: legacyDecision || (queue === "send" ? "ALLOW" : queue === "review" ? "REVIEW" : "BLOCK"),
    queue,
    legacyDecision: legacyDecision || undefined,
    riskScore: Number.isFinite(riskScore) ? riskScore : undefined,
    confidence,
    reasonCodes,
    primaryReason,
    recommendedAction,
    businessImpact,
    evidence,
  };
}

export function calculateCampaignReadinessScore(decisions: ContactAuditDecision[]): number {
  const total = decisions.length;
  if (total === 0) return 0;

  const suppressRate = decisions.filter((item) => item.queue === "suppress").length / total;
  const reviewRate = decisions.filter((item) => item.queue === "review").length / total;
  let score = 100;

  score -= suppressRate * 120;
  score -= reviewRate * 35;

  const topRiskSignals = buildTopRiskReasons(decisions).map((item) => item.reasonCode);
  for (const code of topRiskSignals) {
    if (["INVALID_SYNTAX", "DISPOSABLE_DOMAIN", "NO_MX", "BLACKLIST_HIT", "SMTP_FAILURE"].includes(code)) {
      score -= 8;
    } else if (["ROLE_BASED_EMAIL", "FREE_EMAIL_PROVIDER", "SUSPICIOUS_LOCAL_PART", "DOMAIN_TOO_NEW", "PROXY_OR_VPN", "DATACENTER_IP", "HIGH_RISK_COUNTRY"].includes(code)) {
      score -= 4;
    }
  }

  return clamp(Math.round(score), 0, 100);
}

export function determineLaunchStatus(
  decisionsOrSummary: ContactAuditDecision[] | Pick<ListAuditSummary, "sendRate" | "reviewRate" | "suppressRate">,
): LaunchStatus {
  const rates = Array.isArray(decisionsOrSummary)
    ? {
        sendRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "send").length / decisionsOrSummary.length : 0,
        reviewRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "review").length / decisionsOrSummary.length : 0,
        suppressRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "suppress").length / decisionsOrSummary.length : 0,
      }
    : decisionsOrSummary;

  if (rates.suppressRate <= 0.03 && rates.reviewRate <= 0.15) return "ready_to_launch";
  if (rates.suppressRate <= 0.12 && rates.reviewRate <= 0.35) return "launch_with_caution";
  return "do_not_launch";
}

export function determineListAcceptance(
  decisionsOrSummary: ContactAuditDecision[] | Pick<ListAuditSummary, "sendRate" | "reviewRate" | "suppressRate" | "launchStatus"> & Partial<Pick<ListAuditSummary, "launchStatus">>,
): ListAcceptance {
  const launchStatus = Array.isArray(decisionsOrSummary)
    ? determineLaunchStatus(decisionsOrSummary)
    : decisionsOrSummary.launchStatus || determineLaunchStatus(decisionsOrSummary);

  const rates = Array.isArray(decisionsOrSummary)
    ? {
        sendRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "send").length / decisionsOrSummary.length : 0,
        reviewRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "review").length / decisionsOrSummary.length : 0,
        suppressRate: decisionsOrSummary.length ? decisionsOrSummary.filter((item) => item.queue === "suppress").length / decisionsOrSummary.length : 0,
      }
    : decisionsOrSummary;

  if (launchStatus === "ready_to_launch") return "accept_as_is";
  if (rates.suppressRate >= 0.18) return "reject_do_not_send";
  if (rates.reviewRate >= 0.45) return "needs_enrichment";
  return "accept_after_cleanup";
}

export function buildTopRiskReasons(decisions: ContactAuditDecision[]): Array<{ reasonCode: string; count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const decision of decisions) {
    for (const code of decision.reasonCodes) {
      const meta = getReasonLabel(code);
      if (meta.severity === "positive") continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([reasonCode, count]) => ({
      reasonCode,
      count,
      label: getReasonLabel(reasonCode).label,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

export function estimateWastePrevented(decisions: ContactAuditDecision[]): {
  riskySendsPrevented: number;
  estimatedSendingCreditsSaved: number;
  estimatedSdrTimeSavedHours: number;
  estimatedWasteSavedUsd: number;
} {
  const suppressCount = decisions.filter((item) => item.queue === "suppress").length;
  const estimatedSdrTimeSavedHours = roundTo((suppressCount * DEFAULT_SDR_MINUTES_SAVED_PER_SUPPRESS_CONTACT) / 60, 2);
  const estimatedWasteSavedUsd = roundTo(
    (suppressCount * DEFAULT_SENDING_COST_PER_RISKY_SEND_USD) +
      (estimatedSdrTimeSavedHours * DEFAULT_SDR_HOURLY_COST_USD),
    2,
  );

  return {
    riskySendsPrevented: suppressCount,
    estimatedSendingCreditsSaved: suppressCount,
    estimatedSdrTimeSavedHours,
    estimatedWasteSavedUsd,
  };
}

export function buildRecommendedWorkflow(launchStatus: LaunchStatus): string[] {
  if (launchStatus === "ready_to_launch") {
    return [
      "Export the Send segment to your campaign.",
      "Keep the Review segment for optional enrichment.",
      "Keep the Suppress segment out of automated outreach.",
    ];
  }

  if (launchStatus === "launch_with_caution") {
    return [
      "Launch only to the Send segment first.",
      "Review uncertain contacts before adding them to outreach.",
      "Suppress high-risk contacts before sending.",
      "Re-run the list after enrichment.",
    ];
  }

  return [
    "Do not launch this list as-is.",
    "Remove Suppress contacts first.",
    "Enrich or replace Review contacts.",
    "Re-audit the list before sending.",
  ];
}

export function buildClientRiskBrief(
  launchStatus: LaunchStatus,
  summary: Pick<ListAuditSummary, "sendRate" | "reviewRate" | "suppressRate">,
): string {
  if (launchStatus === "ready_to_launch") {
    return "This list appears ready for a controlled outbound launch. We recommend sending to the Send segment first and keeping review and suppression segments separate.";
  }

  if (launchStatus === "launch_with_caution") {
    return "This list is not recommended for full-volume sending as-is. We recommend launching only to the Send segment first, reviewing uncertain contacts, and suppressing high-risk emails before launch.";
  }

  const riskyShare = Math.round((summary.reviewRate + summary.suppressRate) * 100);
  return `This list should not be launched as-is. About ${riskyShare}% of contacts need review or suppression, which may increase bounce, waste, or sender reputation risk.`;
}

export function buildListAuditSummary(decisions: ContactAuditDecision[]): ListAuditSummary {
  const total = decisions.length;
  const sendCount = decisions.filter((item) => item.queue === "send").length;
  const reviewCount = decisions.filter((item) => item.queue === "review").length;
  const suppressCount = decisions.filter((item) => item.queue === "suppress").length;

  const sendRate = total ? sendCount / total : 0;
  const reviewRate = total ? reviewCount / total : 0;
  const suppressRate = total ? suppressCount / total : 0;

  const launchStatus = determineLaunchStatus({ sendRate, reviewRate, suppressRate });
  const listAcceptance = determineListAcceptance({ sendRate, reviewRate, suppressRate, launchStatus });
  const campaignReadinessScore = calculateCampaignReadinessScore(decisions);
  const topRiskReasons = buildTopRiskReasons(decisions);
  const estimatedWastePrevented = estimateWastePrevented(decisions);
  const recommendedWorkflow = buildRecommendedWorkflow(launchStatus);
  const clientRiskBrief = buildClientRiskBrief(launchStatus, { sendRate, reviewRate, suppressRate });

  return {
    total,
    sendCount,
    reviewCount,
    suppressCount,
    sendRate: roundTo(sendRate, 4),
    reviewRate: roundTo(reviewRate, 4),
    suppressRate: roundTo(suppressRate, 4),
    campaignReadinessScore,
    launchStatus,
    listAcceptance,
    topRiskReasons,
    estimatedWastePrevented,
    recommendedWorkflow,
    clientRiskBrief,
  };
}

