export type SampleDecision = "SEND" | "REVIEW" | "SUPPRESS";

export type SampleAuditContact = {
  result: number;
  email: string;
  decision: SampleDecision;
  score: number;
  primaryReason: string;
  recommendedAction: string;
  evidenceState: string;
  riskTags: string[];
};

export const sampleAuditContacts: readonly SampleAuditContact[] = [
  { result: 1, email: "ava.morgan@example.com", decision: "SEND", score: 8, primaryReason: "No blocking signal detected", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 2, email: "liam.chen@example.net", decision: "SEND", score: 12, primaryReason: "Standard contact pattern", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 3, email: "maya.patel@example.org", decision: "SEND", score: 15, primaryReason: "No blocking signal detected", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 4, email: "noah.williams@example.com", decision: "SEND", score: 10, primaryReason: "Standard contact pattern", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 5, email: "sofia.rossi@example.net", decision: "SEND", score: 18, primaryReason: "Available evidence is consistent", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 6, email: "ethan.kim@example.org", decision: "SEND", score: 6, primaryReason: "No blocking signal detected", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 7, email: "isla.brown@example.com", decision: "SEND", score: 20, primaryReason: "Available evidence is consistent", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Mailbox response not tested", riskTags: [] },
  { result: 8, email: "lucas.martin@example.net", decision: "SEND", score: 14, primaryReason: "Standard contact pattern", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Domain evidence available", riskTags: [] },
  { result: 9, email: "amina.hassan@example.org", decision: "SEND", score: 22, primaryReason: "No blocking signal detected", recommendedAction: "Proceed under normal campaign controls", evidenceState: "Mailbox response not tested", riskTags: [] },
  { result: 10, email: "sales@example.com", decision: "REVIEW", score: 38, primaryReason: "Role-based address", recommendedAction: "Confirm the intended recipient or owner", evidenceState: "Domain evidence available", riskTags: ["manual-review"] },
  { result: 11, email: "partnerships@example.net", decision: "REVIEW", score: 42, primaryReason: "Role-based address", recommendedAction: "Confirm the intended recipient or owner", evidenceState: "Mailbox response not tested", riskTags: ["manual-review"] },
  { result: 12, email: "mila.stone@example.org", decision: "REVIEW", score: 45, primaryReason: "Catch-all evidence", recommendedAction: "Review account context before sending", evidenceState: "Mailbox cannot be confirmed individually", riskTags: ["manual-review"] },
  { result: 13, email: "jon.smyth@example.com", decision: "REVIEW", score: 51, primaryReason: "Possible domain typo", recommendedAction: "Confirm the address with the source", evidenceState: "Domain spelling needs review", riskTags: ["manual-review", "domain-typo"] },
  { result: 14, email: "ops.team@example.net", decision: "REVIEW", score: 55, primaryReason: "Evidence unavailable", recommendedAction: "Retry later or verify with account context", evidenceState: "Lookup failed; evidence unavailable", riskTags: ["manual-review", "evidence-unavailable"] },
  { result: 15, email: "alex.taylor@example.org", decision: "REVIEW", score: 33, primaryReason: "Mailbox unconfirmed", recommendedAction: "Review identity before campaign approval", evidenceState: "MX available; mailbox response unconfirmed", riskTags: ["manual-review"] },
  { result: 16, email: "temp.access@example.com", decision: "SUPPRESS", score: 82, primaryReason: "Disposable mailbox", recommendedAction: "Remove from the launch list", evidenceState: "Disposable pattern detected", riskTags: ["disposable"] },
  { result: 17, email: "casey.holt@example.net", decision: "SUPPRESS", score: 76, primaryReason: "No usable MX", recommendedAction: "Suppress until domain routing is corrected", evidenceState: "No usable MX evidence", riskTags: ["no-mx"] },
  { result: 18, email: "launch.test@example.org", decision: "SUPPRESS", score: 88, primaryReason: "Reserved or test domain", recommendedAction: "Remove test data before launch", evidenceState: "Reserved test pattern detected", riskTags: ["reserved-domain"] },
  { result: 19, email: "invalid..syntax@example.com", decision: "SUPPRESS", score: 95, primaryReason: "Invalid email syntax", recommendedAction: "Correct or remove the address", evidenceState: "Syntax check failed", riskTags: ["invalid-syntax"] },
  { result: 20, email: "taylr.reed@example.net", decision: "SUPPRESS", score: 70, primaryReason: "Possible domain typo", recommendedAction: "Correct the domain before use", evidenceState: "Domain spelling conflict detected", riskTags: ["domain-typo"] },
] as const;
