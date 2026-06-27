import fs from "fs";
import path from "path";

const root = process.cwd();
const tsPath = path.join(root, "src/lib/credits-ledger.ts");
const sqlPath = path.join(root, "supabase-credits-ledger.sql");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const ts = read(tsPath);
const sql = read(sqlPath);

const requiredTypes = [
  "CreditType",
  "CreditSourceType",
  "CreditGrantStatus",
  "CreditUsageReason",
  "CreditGrant",
  "CreditUsageAllocation",
  "CreditSummary",
];

for (const needle of requiredTypes) {
  assert(ts.includes(`export type ${needle}`) || ts.includes(`export interface ${needle}`) || ts.includes(`export const ${needle}`), `Missing TS type export: ${needle}`);
}

const requiredFunctions = [
  "normalizeCreditGrant",
  "isCreditGrantUsable",
  "sortCreditGrantsForConsumption",
  "calculateCreditSummary",
  "planCreditConsumption",
  "getInsufficientCreditsMessage",
  "markExpiredCreditGrants",
];

for (const needle of requiredFunctions) {
  assert(ts.includes(`export function ${needle}`), `Missing TS function export: ${needle}`);
}

assert(!ts.includes("createClient("), "credits-ledger.ts must not connect to Supabase");
assert(!ts.includes("process.env"), "credits-ledger.ts must not read env vars");

const requiredSqlSnippets = [
  "create table if not exists public.credit_grants",
  "create table if not exists public.credit_usage",
  "enable row level security",
  "contact_audit",
  "client_report",
  "expires_at",
  "referral_bonus",
  "top_up",
  "Do not run automatically",
];

for (const needle of requiredSqlSnippets) {
  assert(sql.includes(needle), `Missing SQL snippet: ${needle}`);
}

assert(!sql.includes("drop table"), "SQL draft should not drop tables");
assert(!sql.includes("alter table profiles drop"), "SQL draft should not remove existing profile credit logic");
assert(!sql.includes("create or replace function consume_credit"), "SQL draft should not replace existing consume_credit RPC");

console.log("Credits ledger shape check passed.");
