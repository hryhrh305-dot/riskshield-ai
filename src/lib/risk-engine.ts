import dns from "dns/promises";
import { checkBlacklist, autoBlacklistIfHighRisk } from "@/lib/blacklist";
import { disposableDomainsSet } from "@/lib/disposable-domains";
import { applyDecisionIntegrity, classifyMxEvidence, sanitizeDecisionText, type MxEvidenceStatus } from "@/lib/decision-integrity";
import { isRoleBasedEmail } from "@/lib/email-classification";
export { canonicalRoleLocalPart, isRoleBasedEmail, roleBasedPrefixes } from "@/lib/email-classification";
const disposableDomains: Set<string> = disposableDomainsSet;

// ============ INPUT FIREWALL (SANITIZER) ============
// Reject garbage input BEFORE scoring ? empty strings, headers, invalid formats, etc.

const EMAIL_REGEX = /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i;

/**
 * Validate a single email string.
 * Returns the normalized (lowercased) email, or null if invalid.
 */
export function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  if (!s) return null;                          // empty / whitespace-only
  if (s.startsWith("#")) return null;           // markdown-style headers
  if (s.includes(" ")) return null;             // spaces = not an email
  if (!EMAIL_REGEX.test(s)) return null;        // fails basic email pattern
  return s;
}

/**
 * Validate and clean an array of email strings.
 * Skips empty rows, headers (#), spaces, and malformed inputs.
 * Returns only valid, normalized emails.
 */
export function cleanEmails(rawList: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawList) {
    const cleaned = cleanEmail(raw);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

// ============ LAYER 1: LOCAL RULES (ZERO COST) ============


export const suspiciousTLDs = new Set([
  // Free/abused ccTLDs
  ".tk", ".ml", ".ga", ".cf", ".gq",
  // High-abuse gTLDs
  ".xyz", ".top", ".work", ".click", ".space", ".website", ".site", ".online", ".tech",
  ".store", ".fun", ".lol", ".monster", ".press", ".rest", ".gdn",
  ".win", ".bid", ".trade", ".loan", ".download", ".racing", ".review", ".country",
  ".stream", ".accountant", ".science", ".date", ".party", ".faith", ".cricket",
  ".men", ".wang", ".club", ".link", ".biz", ".info", ".cc",
  ".today", ".icu", ".cyou", ".live", ".world", ".life",
]);

// ============ LAYER 2: CACHE (ZERO COST) ============

interface CacheEntry { data: Record<string, unknown>; ts: number; }
const ipCache = new Map<string, CacheEntry>();
const dnsCache = new Map<string, CacheEntry>();
const domainAgeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;


// ============ RESULT-LEVEL CACHE (7-day TTL; cache hits remain billable) ============
const resultCache = new Map<string, { result: Record<string, unknown>; ts: number }>();
const RESULT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const explanationCache = new Map<string, { value: string; ts: number }>();
const EXPLANATION_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getCachedResult(key: string): Record<string, unknown> | null {
  const entry = resultCache.get(key);
  if (entry && Date.now() - entry.ts < RESULT_CACHE_TTL) return entry.result;
  // Expired ?clean up
  if (entry) resultCache.delete(key);
  return null;
}

export function setCachedResult(key: string, result: Record<string, unknown>): void {
  // Evict oldest if cache grows beyond 10000 entries
  if (resultCache.size > 10000) {
    const oldest = [...resultCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) resultCache.delete(oldest[0]);
  }
  resultCache.set(key, { result, ts: Date.now() });
}

export function makeResultCacheKey(email?: string | null, ip?: string | null): string {
  return [email || "", ip || ""].join("|").toLowerCase();
}

function getCachedExplanation(key: string): string | null {
  const entry = explanationCache.get(key);
  if (entry && Date.now() - entry.ts < EXPLANATION_CACHE_TTL) return entry.value;
  if (entry) explanationCache.delete(key);
  return null;
}

function setCachedExplanation(key: string, value: string): void {
  if (!value) return;
  if (explanationCache.size > 5000) {
    const oldest = [...explanationCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) explanationCache.delete(oldest[0]);
  }
  explanationCache.set(key, { value, ts: Date.now() });
}

function canonicalizeReason(reason: string): string {
  const text = reason.toLowerCase();
  if (text.includes("disposable email")) return "disposable_email";
  if (text.includes("role-based email")) return "role_based_email";
  if (text.includes("suspicious tld")) return "suspicious_tld";
  if (text.includes("high-risk keyword")) return "high_risk_domain_keyword";
  if (text.includes("blacklist")) return "blacklisted";
  if (text.includes("no mx records")) return "no_mx_records";
  if (text.includes("missing spf")) return "missing_spf";
  if (text.includes("missing dmarc")) return "missing_dmarc";
  if (text.includes("missing dkim")) return "missing_dkim";
  if (text.includes("mailbox full") || text.includes("inbox full")) return "mailbox_full";
  if (text.includes("temporary delivery failure") || text.includes("temporarily rejecting")) return "smtp_temp_failure";
  if (text.includes("permanent rejection") || text.includes("mailbox does not exist")) return "smtp_permanent_failure";
  if (text.includes("catch-all")) return "catch_all";
  if (text.includes("proxy") || text.includes("vpn")) return "proxy_vpn";
  if (text.includes("datacenter") || text.includes("hosting ip")) return "hosting_ip";
  if (text.includes("high-risk country")) return "high_risk_country";
  if (text.includes("newly registered") || text.includes("domain age")) return "new_domain";
  if (text.includes("invalid email format")) return "invalid_email_format";
  return "generic_risk";
}

function buildExplanationPayload(
  riskScore: number,
  reasons: string[],
  email: string | null,
  ip: string | null
) {
  const canonicalReasons = [...new Set(reasons.map(canonicalizeReason))].sort();
  return {
    score_bucket: Math.min(100, Math.floor(riskScore / 10) * 10),
    severity: riskScore >= 85 ? "critical" : riskScore >= 70 ? "high" : "medium",
    reason_tags: canonicalReasons,
    has_email: !!email,
    has_ip: !!ip,
  };
}

function buildExplanationCacheKey(plan: string, riskScore: number, reasons: string[], email: string | null, ip: string | null): string {
  return JSON.stringify({
    v: 2,
    plan,
    ...buildExplanationPayload(riskScore, reasons, email, ip),
  });
}

function getLocalExplanationFromTags(reasonTags: string[], riskScore: number): string {
  const parts: string[] = [];

  if (reasonTags.includes("disposable_email")) parts.push("Disposable email detected, often used for temporary signups or low-quality leads");
  if (reasonTags.includes("smtp_permanent_failure")) parts.push("The mailbox was explicitly rejected by the server, so the address is likely invalid or inactive");
  if (reasonTags.includes("mailbox_full")) parts.push("The mailbox is full, so delivery is likely to bounce");
  if (reasonTags.includes("smtp_temp_failure")) parts.push("The mailbox is temporarily rejecting mail, so delivery reliability is lower right now");
  if (reasonTags.includes("no_mx_records")) parts.push("The domain has no usable mail server records, so email is unlikely to be delivered");
  if (reasonTags.includes("catch_all")) parts.push("The domain may be catch-all, so mailbox validity cannot be confirmed reliably");
  if (reasonTags.includes("proxy_vpn")) parts.push("A proxy or VPN source was detected, which can hide the real origin");
  if (reasonTags.includes("hosting_ip")) parts.push("The source IP is in hosting or datacenter infrastructure, which is higher risk for automation");
  if (reasonTags.includes("high_risk_country")) parts.push("The source region is higher risk, so manual review should be stricter");
  if (reasonTags.includes("blacklisted")) parts.push("The target or source matched a prior risk blacklist");
  if (reasonTags.includes("new_domain")) parts.push("The domain is relatively new, so stability and trustworthiness still need observation");
  if (reasonTags.includes("suspicious_tld")) parts.push("The domain extension is associated with higher abuse rates");
  if (reasonTags.includes("high_risk_domain_keyword")) parts.push("The domain keyword pattern looks unusual and may indicate fraud or phishing");
  if (reasonTags.includes("role_based_email")) parts.push("This is a role-based mailbox, so lead authenticity and response quality are usually weaker");

  if (parts.length > 0) {
    return parts.slice(0, 2).join("; ") + ".";
  }

  if (riskScore >= 85) return "Multiple high-risk signals were detected, so blocking or manual review is recommended.";
  if (riskScore >= 70) return "This check matched clear risk signals, so manual review is recommended before sending.";
  return "";
}

// ============ LAYER 3: EXTERNAL API HELPERS ============

export async function lookupIP(ip: string): Promise<Record<string, unknown> | null> {
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return null;
  }
  try {
    const res = await fetch("http://ip-api.com/json/" + ip + "?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,proxy,hosting,mobile", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    ipCache.set(ip, { data, ts: Date.now() });
    return data;
  } catch { return null; }
}

// ============ DNS HELPERS ============

export async function checkMXRecord(domain: string): Promise<{ hasMX: boolean; mxRecords: string[]; mxChecked: boolean; domainExists?: boolean; mxStatus: MxEvidenceStatus }> {
  const cached = dnsCache.get("mx:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasMX: boolean; mxRecords: string[]; mxChecked: boolean; domainExists?: boolean; mxStatus: MxEvidenceStatus };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8", "1.1.1.1"]];
  const errorCodes: string[] = [];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveMx(domain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const mxStatus = classifyMxEvidence({ records });
      const result = { hasMX: mxStatus === "present", mxRecords: records.map(r => r.exchange), mxChecked: true, domainExists: true, mxStatus };
      dnsCache.set("mx:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch (error) {
      const code = String((error as NodeJS.ErrnoException)?.code || (error as Error)?.message || "lookup_failed");
      errorCodes.push(code);
    }
  }
  const terminalCode = errorCodes.find((code) => /ENODATA|ENOTFOUND|ENONAME|NXDOMAIN/i.test(code))
    || (errorCodes.every((code) => /TIMEOUT/i.test(code)) ? "ETIMEOUT" : errorCodes.at(-1) || "lookup_failed");
  const mxStatus = classifyMxEvidence({ records: [], errorCode: terminalCode });
  const result = {
    hasMX: false,
    mxRecords: [] as string[],
    mxChecked: mxStatus === "absent",
    domainExists: mxStatus !== "absent" ? undefined : false,
    mxStatus,
  };
  dnsCache.set("mx:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
  return result;
}

export async function checkSPFRecord(domain: string): Promise<{ hasSPF: boolean; spfRecord: string; spfChecked: boolean; spfStatus: "present" | "absent" | "lookup_failed" }> {
  const cached = dnsCache.get("spf:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasSPF: boolean; spfRecord: string; spfChecked: boolean; spfStatus: "present" | "absent" | "lookup_failed" };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8", "1.1.1.1"]];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveTxt(domain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const allText = records.flatMap(r => r.join("")).join(" ").toLowerCase();
      const hasSPF = allText.includes("v=spf1");
      const spfRecord = records.map(r => r.join("")).find(t => t.toLowerCase().includes("v=spf1")) || "";
      const result = { hasSPF, spfRecord, spfChecked: true, spfStatus: hasSPF ? "present" as const : "absent" as const };
      dnsCache.set("spf:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch { /* try next */ }
  }
  return { hasSPF: false, spfRecord: "", spfChecked: false, spfStatus: "lookup_failed" };
}

export async function checkDMARCRecord(domain: string): Promise<{ hasDMARC: boolean; dmarcRecord: string; dmarcChecked: boolean; dmarcPolicy: string; dmarcStatus: "present" | "absent" | "lookup_failed" }> {
  const dmarcDomain = "_dmarc." + domain;
  const cached = dnsCache.get("dmarc:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasDMARC: boolean; dmarcRecord: string; dmarcChecked: boolean; dmarcPolicy: string; dmarcStatus: "present" | "absent" | "lookup_failed" };
  }
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8", "1.1.1.1"]];
  for (const servers of dnsServers) {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(servers);
      const records = await Promise.race([
        resolver.resolveTxt(dmarcDomain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      const allText = records.flatMap(r => r.join("")).join(" ").toLowerCase();
      const hasDMARC = allText.includes("v=dmarc1");
      const dmarcRecord = records.map(r => r.join("")).find(t => t.toLowerCase().includes("v=dmarc1")) || "";
      let dmarcPolicy = "none";
      if (dmarcRecord.includes("p=reject")) dmarcPolicy = "reject";
      else if (dmarcRecord.includes("p=quarantine")) dmarcPolicy = "quarantine";
      const result = { hasDMARC, dmarcRecord, dmarcChecked: true, dmarcPolicy, dmarcStatus: hasDMARC ? "present" as const : "absent" as const };
      dnsCache.set("dmarc:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
      return result;
    } catch { /* try next */ }
  }
  return { hasDMARC: false, dmarcRecord: "", dmarcChecked: false, dmarcPolicy: "none", dmarcStatus: "lookup_failed" };
}

// ============ DKIM RECORD CHECK ============

export async function checkDKIMRecord(domain: string): Promise<{
  hasDKIM: boolean; dkimRecord: string; dkimChecked: boolean; dkimSelector: string; dkimStatus: "present" | "absent" | "lookup_failed";
}> {
  const cached = dnsCache.get("dkim:" + domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as { hasDKIM: boolean; dkimRecord: string; dkimChecked: boolean; dkimSelector: string; dkimStatus: "present" | "absent" | "lookup_failed" };
  }
  const selectors = ["default", "google", "selector1", "selector2", "dkim", "s1", "s2", "k1", "mandrill", "sendgrid", "mail", "email"];
  const dnsServers = [["114.114.114.114"], ["223.5.5.5"], ["8.8.8.8", "1.1.1.1"]];
  let definitiveNegative = false;
  for (const servers of dnsServers) {
    for (const selector of selectors) {
      try {
        const dkimDomain = selector + "._domainkey." + domain;
        const resolver = new dns.Resolver();
        resolver.setServers(servers);
        const records = await Promise.race([
          resolver.resolveTxt(dkimDomain),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000))
        ]);
        const allText = records.flatMap(r => r.join("")).join(" ").toLowerCase();
        if (allText.includes("v=dkim1")) {
          const dkimRecord = records.map(r => r.join("")).find(t => t.toLowerCase().includes("v=dkim1")) || "";
          const result = { hasDKIM: true, dkimRecord, dkimChecked: true, dkimSelector: selector, dkimStatus: "present" as const };
          dnsCache.set("dkim:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
          return result;
        }
      } catch (error) {
        const code = String((error as NodeJS.ErrnoException)?.code || "").toUpperCase();
        if (["ENODATA", "ENOTFOUND", "ENONAME", "NXDOMAIN"].some((value) => code.includes(value))) definitiveNegative = true;
      }
    }
  }
  const result = { hasDKIM: false, dkimRecord: "", dkimChecked: definitiveNegative, dkimSelector: "", dkimStatus: definitiveNegative ? "absent" as const : "lookup_failed" as const };
  dnsCache.set("dkim:" + domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
  return result;
}

// ============ LAYER 4: AI (ONLY FOR HIGH RISK) ============

export async function calculateRiskScore({
  email,
  ip,
  shouldCheckMX = true,
  domainAgeDays,
}: {
  email?: string | null;
  ip?: string | null;
  shouldCheckMX?: boolean;
  domainAgeDays?: number | null;
  ipInfo?: Record<string, unknown> | null;
}): Promise<{
  score: number;
  reasons: string[];
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  emailDetails: Record<string, unknown> | null;
  ipDetails: Record<string, unknown> | null;
  blacklistHits: string[];
  impact: string[];
  solution: { category: string; problem: string; fix: string }[];
  risk_factors: string[];
  recommendation: string;
  decision_explanation: string;
  estimated_waste_cost: number;
  confidence: "high" | "medium" | "low";
  checksPerformed: string[];
  checksSkipped: string[];
}> {
  let riskScore = 0;
  let recipientDomainPostureAdjustment = 0;
  const reasons: string[] = [];
  const blacklistHits: string[] = [];
  let emailDetails: Record<string, unknown> | null = null;
  let ipDetails: Record<string, unknown> | null = null;

  // ============ CATEGORY 1: FORMAT & IDENTITY CHECK ============

  if (email) {
    emailDetails = {};
    const parts = email.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      riskScore += 50;
      reasons.push("Invalid email format");
    } else {
      const domain = parts[1].toLowerCase();
      const localPart = parts[0].toLowerCase();

      // ---- 1a: Disposable / fake registration detection ----
      if (disposableDomains.has(domain)) {
        riskScore += 40;
        reasons.push("Disposable email ?likely fake/temporary registration");
      }

      // ---- 1b: Role-based email detection ----
      if (isRoleBasedEmail(localPart)) {
        riskScore += 20;
        reasons.push("Role-based email - not a personal address (higher risk for cold outreach)");
      }

      // ---- 1c: Suspicious TLD ----
      const tld = "." + domain.split(".").pop();
      if (suspiciousTLDs.has(tld)) {
        riskScore += 15;
        reasons.push("Suspicious TLD: " + tld + " - high abuse rate, commonly used for spam/fraud");
      }

      // Domain keyword semantic penalty (scam/phishing/fraud keywords in domain name)
      const domainKeywords = ["scam", "phish", "malicious", "danger", "fraud", "spam", "fake",
        "hack", "crack", "warez", "pirate", "steal", "theft", "exploit",
        "offer-now", "limited-deal", "free-money", "get-rich", "click-here",
        "win-big", "crypto-airdrop", "claim-reward", "verify-account",
        "secure-login", "account-alert", "urgent-update", "bonus-claim",
        "instant-prize", "lucky-winner", "million-dollar", "fast-cash"];
      for (const kw of domainKeywords) {
        if (domain.includes(kw)) {
          riskScore += 30;
          reasons.push("Domain contains high-risk keyword: \"" + kw + "\" - suspicious pattern detected");
          break; // only add once
        }
      }

      // ---- 1d: Suspicious local part patterns (fake registration) ----
      const randomPattern = /^[a-z]{1,3}[0-9]{4,10}$/;
      const gibberishPattern = /^[a-z]{8,20}[0-9]{3,8}$/;
      const spamKeywords = ["test", "spam", "fake", "no-reply", "noreply", "nobody", "admin", "root", "postmaster", "abuse", "support@", "info@", "sales@", "contact@"];
      if (randomPattern.test(localPart) || gibberishPattern.test(localPart)) {
        riskScore += 15;
        reasons.push("Suspicious local-part pattern ?looks auto-generated");
      }
            // Personal/Genuine email patterns (firstname/lastname format) - reduce risk
      const personalPatterns = [/^[a-z]{2,15}\.[a-z]{2,15}$/, /^[a-z]{3,20}$/, /^[a-z]+\.[a-z]+_[0-9]+$/, /^[a-z]{2,15}[a-z]{2,15}$/];
      let isPersonalEmail = personalPatterns.some(p => p.test(localPart.toLowerCase()));
      // Only apply personal pattern discount if NOT disposable and NOT role-based
      const isDisposableCheck = disposableDomains.has(domain);
      const isRoleBasedMailbox = isRoleBasedEmail(localPart);
      if (isPersonalEmail && !spamKeywords.some(kw => localPart.toLowerCase().includes(kw)) && !isDisposableCheck && !isRoleBasedMailbox) {
        riskScore = Math.max(0, riskScore - 10);
        reasons.push("Personal/individual email pattern - higher trust signal");
      }

      const localLower = localPart.toLowerCase();
      for (const kw of spamKeywords) {
        if (localLower === kw || localLower.startsWith(kw.replace("@", ""))) {
          riskScore += 20;
          reasons.push("Generic/non-personal email prefix: " + kw);
          break;
        }
      }

      emailDetails.domain = domain;
      emailDetails.localPart = localPart;
      emailDetails.isDisposable = disposableDomains.has(domain);
      emailDetails.isRoleBased = isRoleBasedEmail(localPart);

      // ---- 1e: Blacklist check ----
      const [blEmail, blDomain] = await Promise.all([
        checkBlacklist("email", email),
        checkBlacklist("domain", domain),
      ]);
      if (blEmail) {
        riskScore += 50;
        reasons.push("Email in blacklist ?flagged from previous abuse");
        blacklistHits.push("email:" + email);
      }
      if (blDomain) {
        riskScore += 35;
        reasons.push("Domain in blacklist: " + domain);
        blacklistHits.push("domain:" + domain);
      }

      // ============ CATEGORY 2: DOMAIN & MAIL SERVER HEALTH ============

      if (shouldCheckMX !== false) {
        const mxPromise = checkMXRecord(domain);
        const spfPromise = checkSPFRecord(domain);
        const dmarcPromise = checkDMARCRecord(domain);
        const dkimPromise = checkDKIMRecord(domain);

        // ---- 2a: MX Record Check (mail server existence) ----
        const mx = await mxPromise;
        emailDetails.hasMX = mx.hasMX;
        emailDetails.mxRecords = mx.mxRecords;
        emailDetails.mxChecked = mx.mxChecked;
        emailDetails.mxStatus = mx.mxStatus;
        emailDetails.domainExists = mx.domainExists;

        if (mx.mxStatus === "absent" || mx.mxStatus === "null_mx") {
          riskScore += 30;
          reasons.push(mx.mxStatus === "null_mx" ? "Null MX - domain explicitly does not accept mail" : "No MX records - domain cannot receive email");
        } else if (mx.mxStatus === "present") {
          riskScore -= 10;
          reasons.push("Valid MX records found - domain can receive email");
        } else {
          reasons.push(mx.mxStatus === "timed_out" ? "MX lookup timed out - retry later" : "MX lookup failed - retry later");
        }

        const [spf, dmarc, dkim] = await Promise.all([spfPromise, dmarcPromise, dkimPromise]);

        // ---- 2b: SPF Record Check ----
        emailDetails.hasSPF = spf.hasSPF;
        emailDetails.spfChecked = spf.spfChecked;
        emailDetails.spfStatus = spf.spfStatus;
        if (spf.spfChecked && !spf.hasSPF) {
          riskScore += 5;
          recipientDomainPostureAdjustment += 5;
          reasons.push("Recipient-domain technical posture: SPF record not found");
        } else if (spf.spfChecked && spf.hasSPF) {
          riskScore -= 5;
          recipientDomainPostureAdjustment -= 5;
          reasons.push("Recipient-domain technical posture: SPF record present");
        }

        // ---- 2c: DMARC Record Check ----
        emailDetails.hasDMARC = dmarc.hasDMARC;
        emailDetails.dmarcChecked = dmarc.dmarcChecked;
        emailDetails.dmarcPolicy = dmarc.dmarcPolicy;
        emailDetails.dmarcStatus = dmarc.dmarcStatus;
        if (dmarc.dmarcChecked && !dmarc.hasDMARC) {
          riskScore += 5;
          recipientDomainPostureAdjustment += 5;
          reasons.push("Recipient-domain technical posture: DMARC record not found");
        } else if (dmarc.dmarcChecked && dmarc.hasDMARC) {
          riskScore -= 5;
          recipientDomainPostureAdjustment -= 5;
          reasons.push("Recipient-domain technical posture: DMARC record present");
        }
        if (dmarc.dmarcPolicy === "reject") {
          riskScore -= 5; // strict DMARC is good
          recipientDomainPostureAdjustment -= 5;
        }

        // ---- 2d: DKIM Record Check ----
        emailDetails.hasDKIM = dkim.hasDKIM;
        emailDetails.dkimChecked = dkim.dkimChecked;
        emailDetails.dkimSelector = dkim.dkimSelector;
        emailDetails.dkimStatus = dkim.dkimStatus;
        if (dkim.dkimChecked && !dkim.hasDKIM) {
          riskScore += 5;
          recipientDomainPostureAdjustment += 5;
          reasons.push("Recipient-domain technical posture: DKIM record not found");
        } else if (dkim.dkimChecked && dkim.hasDKIM) {
          riskScore -= 5;
          recipientDomainPostureAdjustment -= 5;
          reasons.push("Recipient-domain technical posture: DKIM record present (" + dkim.dkimSelector + " selector)");
        }

        // ---- 2e: SMTP Mailbox Existence Check (deep validation) ----
        if (mx.hasMX && mx.mxRecords.length > 0) {
          try {
            const smtpResult = await checkSMTPMailbox(domain, email, mx.mxRecords[0]);
            emailDetails.smtpChecked = smtpResult.checked;
            emailDetails.smtpValid = smtpResult.valid;
            emailDetails.smtpCode = smtpResult.code;
            emailDetails.smtpMessage = smtpResult.message;
            emailDetails.mailboxFull = smtpResult.mailboxFull;
            emailDetails.tempRejected = smtpResult.tempRejected;
            emailDetails.permanentRejected = smtpResult.permanentRejected;

            if (smtpResult.checked) {
              if (smtpResult.permanentRejected) {
                riskScore += 35;
                reasons.push("SMTP permanent rejection ?mailbox does not exist or has been disabled");
              } else if (smtpResult.mailboxFull) {
                riskScore += 20;
                reasons.push("Recipient inbox full ?your email will bounce back");
              } else if (smtpResult.tempRejected) {
                riskScore += 15;
                reasons.push("Temporary delivery failure ?mail server temporarily rejecting emails");
              } else if (!smtpResult.valid) {
                riskScore += 20;
                reasons.push("SMTP validation failed ?mailbox may not exist");
              }
            }

            // P1-6: Catch-all detection - probe with random username
            if (smtpResult.checked && smtpResult.valid) {
              const randomUser = "rs-probe-" + Date.now().toString(36) + "@" + domain;
              try {
                const catchAllResult = await checkSMTPMailbox(domain, randomUser, mx.mxRecords[0]);
                if (catchAllResult.checked && catchAllResult.valid) {
                  emailDetails.isCatchAll = true;
                  emailDetails.catchAllDetected = true;
                  emailDetails.catchAllStatus = "yes";
                  riskScore += 10;
                  reasons.push("Catch-all domain detected - accepts all emails regardless of validity");
                } else if (catchAllResult.checked) {
                  emailDetails.isCatchAll = false;
                  emailDetails.catchAllDetected = false;
                  emailDetails.catchAllStatus = "no";
                } else {
                  emailDetails.catchAllStatus = "lookup_failed";
                }
              } catch {
                emailDetails.catchAllStatus = "lookup_failed";
              }
            }
          } catch {
            // SMTP check failed silently ?not all servers allow it
          }
        }
      }

      // ---- 2e: Email deliverability assessment ----
      emailDetails.inboxProbability = "unknown";
      emailDetails.estimatedBounceRate = "unknown";
      if (emailDetails.mxStatus === "absent" || emailDetails.mxStatus === "null_mx") {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "high (domain does not accept mail)";
      } else if (emailDetails.isDisposable) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "high (disposable mailbox)";
      } else if (emailDetails.smtpChecked && emailDetails.permanentRejected) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "high (mailbox rejected permanently)";
      } else if (emailDetails.smtpChecked && emailDetails.mailboxFull) {
        emailDetails.inboxProbability = "none";
        emailDetails.estimatedBounceRate = "high (inbox full)";
      } else if (emailDetails.smtpChecked && emailDetails.tempRejected) {
        emailDetails.inboxProbability = "unknown";
        emailDetails.estimatedBounceRate = "unknown (temporary rejection)";
      } else if (emailDetails.smtpChecked && emailDetails.smtpValid) {
        emailDetails.inboxProbability = "confirmed";
        emailDetails.estimatedBounceRate = "not estimated";
      }

      // ---- 2f: Sender reputation risk ----
      if (emailDetails.mxStatus === "absent" || emailDetails.mxStatus === "null_mx") {
        emailDetails.senderReputationRisk = "HIGH - domain does not accept mail";
      } else if (emailDetails.isDisposable) {
        emailDetails.senderReputationRisk = "HIGH - disposable mailbox";
      } else if (emailDetails.smtpChecked && emailDetails.permanentRejected) {
        emailDetails.senderReputationRisk = "HIGH - mailbox rejected";
      } else if (emailDetails.smtpChecked && emailDetails.mailboxFull) {
        emailDetails.senderReputationRisk = "MEDIUM - mailbox full";
      } else {
        emailDetails.senderReputationRisk = "Unknown - mailbox-level evidence unavailable";
      }
    }
  }

  // ============ CATEGORY 3: IP ANALYSIS ============

  if (ip) {
    ipDetails = {};
    const blIP = await checkBlacklist("ip", ip);
    if (blIP) {
      riskScore += 50;
      reasons.push("IP in blacklist ?previously reported for abuse");
      blacklistHits.push("ip:" + ip);
    }

    const geoData = await lookupIP(ip);
    if (geoData) {
      ipDetails.country = geoData.country;
      ipDetails.countryCode = geoData.countryCode;
      ipDetails.region = geoData.regionName;
      ipDetails.city = geoData.city;
      ipDetails.isp = geoData.isp;
      ipDetails.org = geoData.org;
      ipDetails.asn = geoData.as;
      ipDetails.asname = geoData.asname;
      ipDetails.reverse = geoData.reverse;

      // ---- 3a: Proxy/VPN detection ----
      if (geoData.proxy) {
        riskScore += 35;
        reasons.push("Proxy/VPN detected ?cannot verify real identity or location");
      }
      ipDetails.isProxy = !!geoData.proxy;

      // ---- 3b: Hosting/datacenter IP ----
      if (geoData.hosting) {
        riskScore += 25;
        reasons.push("Datacenter/hosting IP ?likely automated traffic, not a real person");
      }
      ipDetails.isHosting = !!geoData.hosting;
      ipDetails.isMobile = !!geoData.mobile;

      // ---- 3c: ISP hosting detection ----
      const isp = ((geoData.isp as string) || "").toLowerCase();
      const hostingKeywords = ["hosting", "vps", "server", "cloud", "datacenter", "digitalocean", "linode", "vultr", "ovh", "hetzner", "aws", "azure", "google cloud"];
      const isHostingISP = hostingKeywords.some(k => isp.includes(k));
      if (isHostingISP && !geoData.hosting) {
        riskScore += 12;
        reasons.push("ISP associated with hosting provider ?potential bot/VPN traffic");
      }
      ipDetails.isHostingISP = isHostingISP;

      // ---- 3d: High-risk country ----
      const highRiskCountries = new Set(["NG", "RU", "IR", "KP", "BY", "VE", "UA", "SY", "SD", "CU", "PK", "KH", "BD"]);
      const countryCode = (geoData.countryCode as string) || "";
      if (highRiskCountries.has(countryCode)) {
        riskScore += 20;
        reasons.push("High-risk country: " + (geoData.country || countryCode));
      }
      ipDetails.highRiskCountry = highRiskCountries.has(countryCode);
    } else {
      riskScore += 5;
    }
  }

  // ============ CATEGORY 4: COMPREHENSIVE SCORING & SOLUTION MAPPING ============

  // Preserve the legacy per-signal point values while making recipient-domain
  // authentication posture neutral to the contact-level outbound decision.
  riskScore -= recipientDomainPostureAdjustment;
  riskScore = Math.max(0, Math.min(riskScore, 100));

  // P0-3: No MX records = hard fail. Domain cannot receive any email.
  if (emailDetails?.mxStatus === "absent" || emailDetails?.mxStatus === "null_mx") {
    riskScore = Math.max(riskScore, 75);
    if (!reasons.some(r => r.includes("No MX records"))) {
      reasons.push("No usable MX records - suppress until the domain mail configuration is corrected");
    }
  }

  // Auto-blacklist for very high risk
  if (email && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "email", value: email, risk_score: riskScore, reasons }).catch(() => {});
    if (email.split("@")[1]) {
      autoBlacklistIfHighRisk({ type: "domain", value: email.split("@")[1].toLowerCase(), risk_score: riskScore, reasons }).catch(() => {});
    }
  }
  if (ip && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "ip", value: ip, risk_score: riskScore, reasons }).catch(() => {});
  }

  // ============ CATEGORY 4: DOMAIN AGE (core scoring) ============
  if (domainAgeDays != null) {
    if (domainAgeDays < 90) {
      riskScore += 20;
      reasons.push("Domain less than 90 days old - very new registration");
    } else if (domainAgeDays < 365) {
      riskScore += 10;
      reasons.push("Domain less than 1 year old - relatively new");
    } else if (domainAgeDays >= 365) {
      riskScore -= 10;
      reasons.push("Domain older than 1 year - established domain (trust signal)");
    }
  }

  // ============ CATEGORY 5: IP RISK (core scoring) ============
  if (ipDetails) {
    if (ip === "127.0.0.1" || ip === "::1") {
      riskScore += 10;
      reasons.push("Localhost IP - self-referenced");
    } else if ((ip && (ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip || "")))) {
      riskScore += 5;
      reasons.push("Private network IP - cannot verify external identity");
    }
    if (ipDetails.isProxy === true || ipDetails.proxy === true) {
      riskScore += 30;
      reasons.push("VPN/Proxy detected - identity hidden, potential abuse risk");
    }
    if (ipDetails.isHosting === true || ipDetails.hosting === true) {
      riskScore += 20;
      reasons.push("Datacenter/hosting IP - likely automated traffic");
    }
  }

  // ============ FINAL SCORE CLAMP (0-100) ============
  riskScore = Math.max(0, Math.min(100, riskScore));

  const scoreBasedDecision: "ALLOW" | "REVIEW" | "BLOCK" = riskScore >= 66 ? "BLOCK" : riskScore >= 26 ? "REVIEW" : "ALLOW";
  const mailboxStatus = emailDetails?.smtpChecked
    ? (emailDetails?.smtpValid && !emailDetails?.permanentRejected ? "confirmed" : "rejected")
    : "unconfirmed";
  const integrityResult = email ? applyDecisionIntegrity({
    email,
    score: riskScore,
    decision: scoreBasedDecision,
    isDisposable: emailDetails?.isDisposable === true,
    mxStatus: (emailDetails?.mxStatus as MxEvidenceStatus | undefined) || (shouldCheckMX === false ? "not_tested" : "lookup_failed"),
    mailboxStatus,
    catchAllStatus: emailDetails?.catchAllStatus === "yes" || emailDetails?.catchAllStatus === "no" || emailDetails?.catchAllStatus === "unknown" || emailDetails?.catchAllStatus === "not_tested" || emailDetails?.catchAllStatus === "lookup_failed"
      ? emailDetails.catchAllStatus
      : emailDetails?.isCatchAll === true ? "yes" : emailDetails?.isCatchAll === false ? "no" : emailDetails?.smtpChecked ? "unknown" : "not_tested",
  }) : null;
  const decision: "ALLOW" | "REVIEW" | "BLOCK" = integrityResult?.decision || scoreBasedDecision;

  if (emailDetails && integrityResult) {
    emailDetails.mailboxStatus = mailboxStatus;
    emailDetails.catchAllStatus = integrityResult.catchAllStatus;
    emailDetails.inboxProbability = integrityResult.inboxProbability;
    emailDetails.estimatedBounceRate = integrityResult.estimatedBounceRate;
    emailDetails.decisionExplanation = integrityResult.decisionExplanation;
  }

  // ============ BUSINESS IMPACT ============
  const impact: string[] = [];
  if (decision === "BLOCK") {
    impact.push("[CRITICAL] Do NOT send or reply. High risk of bounce, sender reputation damage, or fraud.");
  } else if (decision === "REVIEW") {
    impact.push("[CAUTION] Risk signals detected. Manual review recommended before sending.");
  } else {
    impact.push("[SEND] No blocking signal was detected in the completed checks.");
  }

  // Email-related impacts
  if (emailDetails?.isDisposable) {
    impact.push("[FAKE REGISTRATION] This is a disposable/temporary email. The address will self-destruct within minutes. Do NOT send ?it will bounce and hurt your sender reputation.");
  }
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) {
    impact.push("[MAILBOX DOES NOT EXIST] Domain has no mail server. Your email will be returned as undeliverable. Repeated bounces lower your sender score with Gmail/Outlook.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.permanentRejected) {
    impact.push("[MAILBOX REJECTED] SMTP server permanently rejected this address. Suppress it until the address is corrected or replaced.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.mailboxFull) {
    impact.push("[INBOX FULL] Recipient mailbox is over quota. Your email will be rejected until they free up space. Wait a few days before retrying.");
  }
  if (emailDetails?.smtpChecked && emailDetails?.tempRejected) {
    impact.push("[TEMPORARY BLOCK] Mail server is temporarily rejecting emails. This could be greylisting or rate limiting. Retry in 15-30 minutes.");
  }

  // IP-related impacts
  if (ipDetails?.isProxy) {
    impact.push("[HIDDEN IDENTITY] Proxy/VPN detected. Cannot verify if this is a real customer or a fraudster. Request additional verification (phone, company website, LinkedIn).");
  }
  if (ipDetails?.highRiskCountry) {
    impact.push("[HIGH-RISK REGION] IP originates from a region with historically low conversion rates and high fraud. Prioritize leads from other regions first.");
  }
  if (ipDetails?.isHosting) {
    impact.push("[NOT A REAL PERSON] Datacenter IP detected. Real customers do not send inquiries from server IPs. Likely automated bot or scraper.");
  }

  if (integrityResult?.limitation) impact.push("[LIMITATION] " + integrityResult.limitation);

  // ============ SOLUTIONS (ACTIONABLE FIXES FOR EACH PROBLEM) ============
  const solution: { category: string; problem: string; fix: string }[] = [];

  // Solution 1: Sender reputation blacklisted
  if (blacklistHits.length > 0) {
    solution.push({
      category: "Sender Reputation Risk",
      problem: "This email or IP is on a known abuse blacklist. Sending to it will damage your sender reputation and may cause your own domain/IP to be blacklisted.",
      fix: "1) Do NOT send email to this address. 2) If this is a customer inquiry, ask them to contact you from a different email. 3) Monitor your own sender reputation via Google Postmaster Tools or MXToolbox. 4) If your domain gets blacklisted, submit a delisting request to the blacklist operator (Spamhaus, Barracuda, etc.)."
    });
  }

  // Solution 2: Mailbox full
  if (emailDetails?.smtpChecked && emailDetails?.mailboxFull) {
    solution.push({
      category: "Inbox Full / Over Quota",
      problem: "The recipient's mailbox has exceeded its storage limit. Any email you send will be rejected with a 'mailbox full' bounce.",
      fix: "1) Wait 3-5 days before retrying ?the recipient needs time to clear space. 2) Try reaching out via alternative channels (LinkedIn, WhatsApp, phone). 3) If this is a business contact, their IT department may need to increase mailbox quota. 4) Set a follow-up reminder in your CRM rather than repeatedly bouncing."
    });
  }

  // Solution 3: Temporary rejection
  if (emailDetails?.smtpChecked && emailDetails?.tempRejected) {
    solution.push({
      category: "Temporary Delivery Block",
      problem: "The recipient mail server is temporarily refusing emails. This is often due to greylisting (anti-spam technique) or rate limiting.",
      fix: "1) Wait 15-30 minutes and retry ?greylisting usually clears after one retry. 2) Ensure your email server has proper SPF/DKIM/DMARC configured. 3) If persists for >24 hours, the receiving server may have permanently blocked your IP range ?contact their postmaster. 4) Use a reputable email sending service (SendGrid, AWS SES) to improve deliverability."
    });
  }

  // Solution 4: Mailbox doesn't exist / permanently rejected
  if (emailDetails?.smtpChecked && emailDetails?.permanentRejected) {
    solution.push({
      category: "Mailbox Does Not Exist / Disabled",
      problem: "The SMTP server permanently rejected this mailbox, so delivery should not be attempted without correction or replacement.",
      fix: "1) Remove this email from your contact list immediately ?never send to it again. 2) Each bounce damages your sender reputation. 3) If this was a customer inquiry, they may have made a typo ?try common corrections (gmail.com vs gmial.com). 4) Use double opt-in for mailing lists to prevent invalid addresses from entering your database."
    });
  }

  // Solution 5: No MX records (domain can't receive mail)
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) {
    solution.push({
      category: "Domain Cannot Receive Email",
      problem: "The domain has no MX (Mail Exchange) records configured. This means the domain literally cannot accept email ?like sending a letter to an address that doesn't exist.",
      fix: "1) Suppress this contact while no usable MX is available. 2) Ask the contact or domain owner to verify the address and mail configuration. 3) Retry only after the domain publishes a usable mail route."
    });
  }

  // Solution 6: Email already expired / disposable
  if (emailDetails?.isDisposable) {
    solution.push({
      category: "Fake / Temporary Email (Disposable)",
      problem: "This is a disposable email address from a temporary email service. These addresses typically self-destruct in 10-60 minutes and are commonly used for fraudulent signups.",
      fix: "1) Do NOT send any business communication to this address ?it has likely already expired. 2) If this came from a signup form, the user is likely fraudulent. 3) Require email verification (double opt-in) for all new signups. 4) Block disposable email domains at the registration level to prevent fake accounts."
    });
  }

  // Solution 7: IP Proxy/VPN (hidden identity)
  if (ipDetails?.isProxy) {
    solution.push({
      category: "Hidden Identity (Proxy/VPN)",
      problem: "The user is hiding behind a proxy or VPN service. Their real location and identity cannot be verified, which is a common fraud signal in e-commerce and trade.",
      fix: "1) Request additional identity verification: company website, LinkedIn profile, business registration number. 2) Require a video call or phone verification before proceeding with orders. 3) Check if the company name matches the claimed country. 4) For high-value transactions, require payment via wire transfer (harder to reverse than credit cards)."
    });
  }

  // Solution 8: High-risk country IP
  if (ipDetails?.highRiskCountry) {
    const c = ipDetails?.country || "this region";
    solution.push({
      category: "High-Risk Region IP",
      problem: "IP originates from " + c + ", a region with historically high fraud rates and low inquiry-to-order conversion in international trade.",
      fix: "1) Do not invest significant time before verifying the buyer is legitimate. 2) Request a 30% advance payment (T/T) before production. 3) Use a trusted third-party inspection service for orders from this region. 4) Check the company against trade blacklists and the local chamber of commerce. 5) Consider requiring L/C (Letter of Credit) payment terms."
    });
  }

  if (solution.length === 0 && decision === "ALLOW") {
    solution.push({
      category: "No Issues Detected",
      problem: "No blocking signal was detected in the completed checks.",
      fix: "Send through your normal controlled outreach workflow and monitor delivery outcomes."
    });
  }

  // ============ RISK FACTORS (structured for display) ============
  const risk_factors: string[] = [];
  if (emailDetails?.isDisposable) risk_factors.push("Disposable email detected - likely fake/temporary registration");
  if (emailDetails?.isRoleBased) risk_factors.push("Role-based email - not a personal address");
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) risk_factors.push("No MX records - domain cannot receive email");
  if (emailDetails?.hasMX === true) risk_factors.push("MX records present - domain can receive email");
  if (emailDetails?.hasSPF === true) risk_factors.push("SPF enabled - domain has sender authentication");
  if (emailDetails?.hasSPF === false && emailDetails?.spfChecked) risk_factors.push("SPF missing - domain lacks sender authentication");
  if (emailDetails?.hasDMARC === true) risk_factors.push("DMARC enabled - domain protected against spoofing");
  if (emailDetails?.hasDMARC === false && emailDetails?.dmarcChecked) risk_factors.push("DMARC missing - domain vulnerable to spoofing");
  if (emailDetails?.hasDKIM === true) risk_factors.push("DKIM enabled - email signing configured (" + (emailDetails?.dkimSelector || "unknown") + " selector)");
  if (emailDetails?.hasDKIM === false && emailDetails?.dkimChecked) risk_factors.push("DKIM missing - email signing not configured");
  if (emailDetails?.smtpChecked && emailDetails?.permanentRejected) risk_factors.push("SMTP permanent rejection - mailbox does not exist or has been disabled");
  if (emailDetails?.smtpChecked && emailDetails?.mailboxFull) risk_factors.push("Inbox full - emails will bounce back");
  if (emailDetails?.smtpChecked && emailDetails?.tempRejected) risk_factors.push("Temporary delivery failure - mail server temporarily rejecting emails");
  if (emailDetails?.senderReputationRisk) risk_factors.push("Sender reputation: " + emailDetails.senderReputationRisk);
  if (blacklistHits.length > 0) risk_factors.push("Blacklisted: " + blacklistHits.join(", "));
  if (ipDetails?.isProxy) risk_factors.push("Proxy/VPN detected - cannot verify real identity");
  if (ipDetails?.isHosting) risk_factors.push("Datacenter/hosting IP - likely automated traffic");
  if (ipDetails?.highRiskCountry) risk_factors.push("High-risk country: " + (ipDetails?.country || "unknown"));
  if (ipDetails?.asn) risk_factors.push("ASN: " + (ipDetails?.asname || ipDetails?.asn || "unknown"));

  // ============ RECOMMENDATION ============
  let recommendation = integrityResult?.recommendation || "";
  if (!recommendation && decision === "BLOCK") {
    recommendation = "Do NOT send email to this address. Sending will result in bounce or damage your sender reputation. Remove from your outreach list immediately.";
  } else if (!recommendation && decision === "REVIEW") {
    recommendation = "Manual verification recommended before bulk outreach. Some risk signals detected. Consider validating the contact through alternative channels first.";
  } else if (!recommendation) {
    recommendation = "Send through your normal controlled outreach workflow.";
  }

  // ============ ESTIMATED WASTE COST ============
  const costPerSend = 0.01; // .01 per email (industry average)
  let estimatedWasteCost = 0;
  if (decision === "BLOCK") estimatedWasteCost = costPerSend;
  else if (decision === "REVIEW") estimatedWasteCost = costPerSend * 0.5;
  if (emailDetails?.isDisposable) estimatedWasteCost = costPerSend * 1.5;
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) estimatedWasteCost = costPerSend * 2;
  estimatedWasteCost = Math.round(estimatedWasteCost * 100) / 100;

  // P2-7: Confidence level based on data completeness
  let confidence: "high" | "medium" | "low" = "medium";
  const checksPerformed: string[] = [];
  const checksSkipped: string[] = [];
  
  if (emailDetails?.mxChecked) checksPerformed.push("MX");
  else checksSkipped.push("MX");
  if (emailDetails?.spfChecked) checksPerformed.push("SPF");
  else checksSkipped.push("SPF");
  if (emailDetails?.dmarcChecked) checksPerformed.push("DMARC");
  else checksSkipped.push("DMARC");
  if (emailDetails?.dkimChecked) checksPerformed.push("DKIM");
  else checksSkipped.push("DKIM");
  if (emailDetails?.smtpChecked) checksPerformed.push("SMTP");
  else checksSkipped.push("SMTP");
  if (emailDetails?.catchAllDetected !== undefined) checksPerformed.push("CatchAll");
  if (ipDetails) checksPerformed.push("IP-Geo");
  
  // High confidence: all DNS checks passed + SMTP confirmed + no data gaps
  if (checksPerformed.length >= 4 && checksSkipped.length === 0 && (emailDetails?.smtpChecked || emailDetails?.hasMX)) {
    confidence = "high";
  } else if (checksPerformed.length >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }
  
  // Demote confidence if disposable (high certainty of risk)
  if (emailDetails?.isDisposable) confidence = "high";
  // Demote if no MX and checked (confirmed hard fail)
  if (emailDetails?.hasMX === false && emailDetails?.mxChecked) confidence = "high";

  return {
    score: riskScore,
    reasons: reasons.map(sanitizeDecisionText),
    decision,
    emailDetails,
    ipDetails,
    blacklistHits,
    impact: impact.map(sanitizeDecisionText),
    solution: solution.map((item) => ({
      ...item,
      problem: sanitizeDecisionText(item.problem),
      fix: sanitizeDecisionText(item.fix),
    })),
    risk_factors: risk_factors.map(sanitizeDecisionText),
    recommendation: sanitizeDecisionText(recommendation),
    decision_explanation: integrityResult?.decisionExplanation || "",
    estimated_waste_cost: estimatedWasteCost,
    confidence,
    checksPerformed,
    checksSkipped,
  };
}


// ============ WHOIS DOMAIN AGE CHECK ============
export async function checkDomainAge(domain: string): Promise<{
  checked: boolean;
  createdDate: string | null;
  ageDays: number | null;
  ageYears: number | null;
  isNew: boolean;
  registrar: string | null;
  }> {
  const cached = domainAgeCache.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as {
      checked: boolean;
      createdDate: string | null;
      ageDays: number | null;
      ageYears: number | null;
      isNew: boolean;
      registrar: string | null;
    };
  }
  const result = { checked: false, createdDate: null as string | null, ageDays: null as number | null, ageYears: null as number | null, isNew: false, registrar: null as string | null };
  try {
    // Use free RDAP protocol (successor to WHOIS) ?no API key needed
    const res = await fetch("https://rdap.verisign.com/domain/v1/" + domain, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      // Try IANA RDAP bootstrap
      const bootstrap = await fetch("https://rdap.iana.org/domain/" + domain, { signal: AbortSignal.timeout(3000) });
      if (!bootstrap.ok) return result;
    }
    const data = await res.json();
    const events = data.events || [];
    for (const ev of events) {
      if (ev.eventAction === "registration") {
        result.createdDate = ev.eventDate;
        result.checked = true;
        const created = new Date(ev.eventDate);
        const now = new Date();
        result.ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        result.ageYears = Math.round(result.ageDays / 365 * 10) / 10;
        result.isNew = result.ageDays < 90;
        break;
      }
    }
    // Try to get registrar
    const entities = data.entities || [];
    for (const ent of entities) {
      if (ent.roles && ent.roles.includes("registrar")) {
        result.registrar = ent.vcardArray?.[1]?.[1]?.[3] || null;
        break;
      }
    }
    domainAgeCache.set(domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
    return result;
  } catch {
    domainAgeCache.set(domain, { data: result as unknown as Record<string, unknown>, ts: Date.now() });
    return result;
  }
}

// ============ DNS HEALTH SCORE ============

export async function getDNSHealthScore(domain: string): Promise<{
  score: number;
  mx: boolean;
  spf: boolean;
  dmarc: boolean;
  dmarcPolicy: string;
  dkim: boolean;
  dkimSelector: string;
  details: string[];
}> {
  const [mx, spf, dmarc, dkim] = await Promise.all([
    checkMXRecord(domain),
    checkSPFRecord(domain),
    checkDMARCRecord(domain),
    checkDKIMRecord(domain),
  ]);
  let score = 0;
  const details: string[] = [];
  if (mx.hasMX && mx.mxChecked) { score += 30; details.push("MX: OK"); }
  else if (mx.mxChecked) { details.push("MX: MISSING"); }
  else { score += 10; details.push("MX: Unknown"); }

  if (spf.hasSPF && spf.spfChecked) { score += 25; details.push("SPF: Present"); }
  else if (spf.spfChecked) { details.push("SPF: Missing"); }

  if (dmarc.hasDMARC && dmarc.dmarcChecked) {
    score += 25;
    details.push("DMARC: Present (" + dmarc.dmarcPolicy + ")");
    if (dmarc.dmarcPolicy === "reject") score += 10;
  } else if (dmarc.dmarcChecked) { details.push("DMARC: Missing"); }

  if (dkim.hasDKIM && dkim.dkimChecked) { score += 25; details.push("DKIM: Present (" + dkim.dkimSelector + ")"); }
  else if (dkim.dkimChecked) { details.push("DKIM: Missing"); }

  // Bonus for all four
  if (mx.hasMX && spf.hasSPF && dmarc.hasDMARC && dkim.hasDKIM) score += 10;
  return {
    score: Math.min(100, score),
    mx: mx.hasMX && mx.mxChecked,
    spf: spf.hasSPF && spf.spfChecked,
    dmarc: dmarc.hasDMARC && dmarc.dmarcChecked,
    dmarcPolicy: dmarc.dmarcPolicy,
    dkim: dkim.hasDKIM && dkim.dkimChecked,
    dkimSelector: dkim.dkimSelector,
    details,
  };
}

// ============ SMTP MAILBOX VALIDATION ============

export async function checkSMTPMailbox(domain: string, email: string, mxHost: string): Promise<{
  checked: boolean;
  valid: boolean;
  code: number;
  message: string;
  mailboxFull: boolean;
  tempRejected: boolean;
  permanentRejected: boolean;
}> {
  const net = await import("net");
  const result = { checked: false, valid: false, code: 0, message: "", mailboxFull: false, tempRejected: false, permanentRejected: false };

  try {
    const smtpCheck = new Promise<typeof result>((resolve) => {
      const socket = new net.Socket();
      let stage = 0;
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ ...result, checked: false, message: "SMTP timeout" });
      }, 3000);

      socket.connect(25, mxHost);

      socket.on("data", (data: Buffer) => {
        const response = data.toString();
        const code = parseInt(response.substring(0, 3)) || 0;

        if (stage === 0) {
          socket.write("HELO riskshield.ai\r\n");
          stage = 1;
        } else if (stage === 1) {
          socket.write("MAIL FROM:<noreply@riskshield.ai>\r\n");
          stage = 2;
        } else if (stage === 2) {
          socket.write("RCPT TO:<" + email + ">\r\n");
          stage = 3;
        } else if (stage === 3) {
          clearTimeout(timeout);
          socket.write("QUIT\r\n");
          socket.destroy();
          resolve({ checked: true, ...classifySmtpResponse(code, response.trim()) });
        }
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ...result, checked: false, message: "Connection refused" });
      });

      socket.on("timeout", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ...result, checked: false, message: "Connection timeout" });
      });
    });

    return await smtpCheck;
  } catch {
    return result;
  }
}

export function classifySmtpResponse(code: number, message: string): {
  valid: boolean;
  code: number;
  message: string;
  mailboxFull: boolean;
  tempRejected: boolean;
  permanentRejected: boolean;
} {
  const text = message.toLowerCase();
  const isMailboxFull =
    code === 552 ||
    text.includes("mailbox full") ||
    text.includes("over quota") ||
    text.includes("quota exceeded") ||
    text.includes("storage limit") ||
    text.includes("inbox full");

  if (code >= 200 && code < 300) {
    return { valid: true, code, message, mailboxFull: false, tempRejected: false, permanentRejected: false };
  }

  if (code >= 400 && code < 500) {
    return { valid: false, code, message, mailboxFull: isMailboxFull, tempRejected: !isMailboxFull, permanentRejected: false };
  }

  if (code >= 500) {
    return {
      valid: false,
      code,
      message,
      mailboxFull: isMailboxFull,
      tempRejected: false,
      permanentRejected: !isMailboxFull,
    };
  }

  return { valid: false, code, message, mailboxFull: false, tempRejected: false, permanentRejected: false };
}


export async function getAIExplanation(
  email: string | null,
  ip: string | null,
  riskScore: number,
  reasons: string[],
  plan = "free"
): Promise<string> {
  if (riskScore < 70) return "";

  const reasonTags = [...new Set(reasons.map(canonicalizeReason))].sort();
  const cacheKey = buildExplanationCacheKey(plan, riskScore, reasons, email, ip);
  const cached = getCachedExplanation(cacheKey);
  if (cached) return cached;

  const localExplanation = getLocalExplanationFromTags(reasonTags, riskScore);
  if (localExplanation) {
    setCachedExplanation(cacheKey, localExplanation);
    return localExplanation;
  }

  const genericExplanation = riskScore >= 85
    ? "Multiple high-risk signals were detected, so blocking or manual review is recommended."
    : "This check matched clear risk signals, so manual review is recommended before sending.";

  setCachedExplanation(cacheKey, genericExplanation);
  return genericExplanation;
}

// ============ SCORING ENGINE ============

export interface RiskScoreResult {
  score: number;
  reasons: string[];
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  risk_factors: string[];
  recommendation: string;
  estimated_waste_cost: number;
  emailDetails: Record<string, unknown> | null;
  ipDetails: Record<string, unknown> | null;
  blacklistHits: string[];
  impact: string[];
}


// ============ COMPANY HEALTH SCORE (COMPREHENSIVE) ============

export interface CompanyHealthResult {
  healthScore: number;
  grade: string;
  stars: string;
  label: string;
  positiveSignals: string[];
  riskSignals: string[];
  recommendation: string;
  breakdown: {
    emailTrust: { score: number; weight: number; details: string };
    domainAge: { score: number; weight: number; details: string };
    dnsHealth: { score: number; weight: number; details: string };
    ipReputation: { score: number; weight: number; details: string };
    companyExistence: { score: number; weight: number; details: string };
    negativeSignals: { penalty: number; weight: number; details: string };
  };
}

export async function calculateCompanyHealth(params: {
  riskScore: number;
  isDisposable: boolean;
  hasMX: boolean;
  hasSPF: boolean;
  hasDMARC: boolean;
  dmarcPolicy: string;
  domainAgeDays: number | null;
  isProxy: boolean;
  isHosting: boolean;
  blacklistHits: string[];
  country: string | null;
  companyName?: string | null;
}): Promise<CompanyHealthResult> {
  const {
    riskScore, isDisposable, hasMX, hasSPF, hasDMARC, dmarcPolicy,
    domainAgeDays, isProxy, isHosting, blacklistHits, country,
  } = params;

  // === Email Trust (25%) ===
  let emailTrust = 100;
  if (isDisposable) emailTrust = 0;
  else if (!hasMX) emailTrust = 10;
  else {
    if (riskScore > 70) emailTrust = Math.max(0, 100 - riskScore);
    else emailTrust = 100 - Math.round(riskScore * 0.6);
  }
  const emailTrustW = 25;

  // === Domain Age (20%) ===
  let domainAge = 50; // default unknown
  let domainAgeDetail = "Unknown";
  if (domainAgeDays !== null) {
    if (domainAgeDays < 90) { domainAge = 10; domainAgeDetail = "Less than 3 months (very new)"; }
    else if (domainAgeDays < 365) { domainAge = 30; domainAgeDetail = "Less than 1 year"; }
    else if (domainAgeDays < 730) { domainAge = 55; domainAgeDetail = "1-2 years"; }
    else if (domainAgeDays < 1825) { domainAge = 75; domainAgeDetail = "2-5 years"; }
    else if (domainAgeDays < 3650) { domainAge = 90; domainAgeDetail = "5-10 years (established)"; }
    else { domainAge = 98; domainAgeDetail = "10+ years (well-established)"; }
  }
  const domainAgeW = 20;

  // === DNS Health (15%) ===
  let dnsHealth = 30;
  let dnsDetail = "";
  if (hasMX) { dnsHealth += 25; dnsDetail = "MX present"; } else dnsDetail = "No MX";
  if (hasSPF) { dnsHealth += 20; dnsDetail += ", SPF"; }
  if (hasDMARC) { dnsHealth += 20; dnsDetail += ", DMARC"; if (dmarcPolicy === "reject") dnsHealth += 5; }
  if (!hasMX && !hasSPF && !hasDMARC) { dnsHealth = 0; dnsDetail = "No email authentication configured"; }
  const dnsHealthW = 15;

  // === IP Reputation (15%) ===
  let ipRep = 100;
  let ipDetail = "Clean";
  if (isProxy) { ipRep -= 40; ipDetail = "Proxy/VPN detected"; }
  if (isHosting) { ipRep -= 30; ipDetail = "Hosting/datacenter IP"; }
  if (blacklistHits.length > 0) { ipRep -= 50; ipDetail = "IP/domain on blacklist"; }
  if (country && ["NG","RU","IR","KP","VE","SY","SD","CU","PK","KH","BD"].includes(country)) {
    ipRep -= 15; ipDetail += " - high-risk region";
  }
  ipRep = Math.max(0, ipRep);
  const ipRepW = 15;

  // === Company Existence (15%) ===
  let companyExistence = 50;
  let companyDetail = "Unknown (no company data)";
  if (domainAgeDays !== null && domainAgeDays > 1825) {
    companyExistence = 80;
    companyDetail = "Domain active for 5+ years (established business likely)";
  }
  if (hasMX && hasSPF && hasDMARC) {
    companyExistence = Math.min(100, companyExistence + 20);
    companyDetail = "Full email infrastructure (operating business)";
  }
  const companyExistenceW = 15;

  // === Negative Signals (10%) ===
  let negativePenalty = 0;
  let negativeDetail = "None";
  if (isDisposable) { negativePenalty = 100; negativeDetail = "Disposable email"; }
  if (blacklistHits.length > 0) { negativePenalty = Math.max(negativePenalty, 60); negativeDetail = "Blacklisted"; }
  if (isProxy && isHosting) { negativePenalty = Math.max(negativePenalty, 50); negativeDetail = "Hidden identity"; }
  const negativeSignalsW = 10;

  // === Weighted Total ===
  const total = Math.round(
    (emailTrust * emailTrustW +
     domainAge * domainAgeW +
     dnsHealth * dnsHealthW +
     ipRep * ipRepW +
     companyExistence * companyExistenceW -
     negativePenalty * negativeSignalsW / 100 * 100) / 100
  );
  const healthScore = Math.max(0, Math.min(100, total));

  // === Grade ===
  let grade: string, stars: string, label: string, recommendation: string;
  if (healthScore >= 85) {
    grade = "A"; stars = "\u2605\u2605\u2605"; label = "Trusted Business";
    recommendation = "Safe for onboarding and sales engagement. Low risk profile.";
  } else if (healthScore >= 70) {
    grade = "B"; stars = "\u2605\u2605\u2605"; label = "Likely Legitimate";
    recommendation = "Proceed with standard verification. Minor risk signals present.";
  } else if (healthScore >= 50) {
    grade = "C"; stars = "\u2605\u2605"; label = "Needs Review";
    recommendation = "Manual review recommended before committing resources. Verify company details.";
  } else if (healthScore >= 30) {
    grade = "D"; stars = "\u2605"; label = "High Risk";
    recommendation = "Significant risk signals detected. Require additional verification before engagement.";
  } else {
    grade = "F"; stars = ""; label = "Do Not Engage";
    recommendation = "Multiple critical risk signals. Do NOT proceed with sales or onboarding.";
  }

  // === Signals ===
  const positiveSignals: string[] = [];
  const riskSignals: string[] = [];

  if (domainAgeDays !== null && domainAgeDays > 1825) positiveSignals.push("Domain active for " + Math.round(domainAgeDays/365) + "+ years");
  if (!isDisposable && hasMX) positiveSignals.push("Corporate email infrastructure detected");
  if (hasSPF) positiveSignals.push("SPF authentication enabled");
  if (hasDMARC) positiveSignals.push("DMARC protection active" + (dmarcPolicy === "reject" ? " (strict policy)" : ""));
  if (blacklistHits.length === 0) positiveSignals.push("No blacklist records found");
  if (!isProxy && !isHosting) positiveSignals.push("Clean IP reputation");

  if (isDisposable) riskSignals.push("Disposable email address ?likely fraudulent");
  if (domainAgeDays !== null && domainAgeDays < 90) riskSignals.push("Domain registered less than 3 months ago");
  if (!hasMX) riskSignals.push("No mail server configured ?cannot receive email");
  if (!hasSPF) riskSignals.push("Missing SPF ?domain vulnerable to spoofing");
  if (blacklistHits.length > 0) riskSignals.push("Found on abuse blacklist (" + blacklistHits.length + " hits)");
  if (isProxy) riskSignals.push("Proxy/VPN detected ?identity hidden");
  if (isHosting) riskSignals.push("Datacenter IP ?likely automated traffic");
  if (companyExistence < 50) riskSignals.push("Limited company existence signals");

  return {
    healthScore, grade, stars, label, recommendation,
    positiveSignals, riskSignals,
    breakdown: {
      emailTrust: { score: emailTrust, weight: emailTrustW, details: isDisposable ? "Disposable" : riskScore > 70 ? "High risk" : "Trusted" },
      domainAge: { score: domainAge, weight: domainAgeW, details: domainAgeDetail },
      dnsHealth: { score: dnsHealth, weight: dnsHealthW, details: dnsDetail },
      ipReputation: { score: ipRep, weight: ipRepW, details: ipDetail },
      companyExistence: { score: companyExistence, weight: companyExistenceW, details: companyDetail },
      negativeSignals: { penalty: negativePenalty, weight: negativeSignalsW, details: negativeDetail },
    },
  };
}


