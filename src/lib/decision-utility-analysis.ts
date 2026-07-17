export const SANITIZED_DECISION_FIELDS = [
  "provider_group",
  "decision",
  "primary_reason_code",
  "risk_score",
  "mx_status",
  "mailbox_status",
  "catch_all_status",
  "disposable",
  "reserved_domain",
] as const;

export type SanitizedDecisionRow = Record<(typeof SANITIZED_DECISION_FIELDS)[number], string>;

const PII_COLUMN_PATTERN = /(^|_)(email|address|original|normalized|user|customer|contact|name|id)($|_)/iu;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("INVALID_CSV_QUOTING");
  values.push(value.trim());
  return values;
}

export function parseSanitizedDecisionCsv(csv: string): SanitizedDecisionRow[] {
  const lines = csv.replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  if (headers.some((header) => PII_COLUMN_PATTERN.test(header))) throw new Error("PII_COLUMN_NOT_ALLOWED");
  for (const field of SANITIZED_DECISION_FIELDS) {
    if (!headers.includes(field)) throw new Error(`MISSING_SANITIZED_FIELD:${field}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`INVALID_CSV_ROW:${rowIndex + 2}`);
    return Object.fromEntries(SANITIZED_DECISION_FIELDS.map((field) => [field, values[headers.indexOf(field)] || "unknown"])) as SanitizedDecisionRow;
  });
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] || 0) + 1;
}

export function analyzeDecisionRows(rows: SanitizedDecisionRow[]) {
  const decisions: Record<string, number> = { ALLOW: 0, REVIEW: 0, BLOCK: 0 };
  const reviewReasons: Record<string, number> = {};
  const providers: Record<string, number> = {};
  const providerDecisions: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const decision = row.decision.toUpperCase();
    if (!(decision in decisions)) throw new Error(`INVALID_DECISION:${decision}`);
    const provider = row.provider_group || "unknown";
    increment(decisions, decision);
    increment(providers, provider);
    providerDecisions[provider] ||= { ALLOW: 0, REVIEW: 0, BLOCK: 0 };
    increment(providerDecisions[provider], decision);
    if (decision === "REVIEW") increment(reviewReasons, row.primary_reason_code || "UNKNOWN_REASON");
  }

  return { total: rows.length, decisions, reviewReasons, providers, providerDecisions };
}
