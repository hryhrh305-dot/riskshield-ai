import fs from "fs";
import path from "path";

const root = process.cwd();
const rulesPath = path.join(root, "src/lib/riskshield-growth-rules.ts");
const docPath = path.join(root, "RISKSHIELD_GROWTH_RULES.md");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rules = read(rulesPath);
const doc = read(docPath);

const requiredConstants = [
  "FREE_UPLOAD_MAX_CONTACTS = 500",
  "FREE_PREVIEW_AUDIT_CONTACTS = 30",
  "FREE_REPORT_LINK_EXPIRES_DAYS = 14",
  "FREE_UPLOAD_RAW_DATA_RETENTION_DAYS = 7",
  "FREE_REPORT_SUMMARY_RETENTION_DAYS = 14",
  "SMALL_REPORT_PRICE_USD = 19",
  "SMALL_REPORT_CONTACT_LIMIT = 120",
  "FOUNDER_STARTER_PRICE_USD = 49",
  "FOUNDER_STARTER_MONTHLY_CONTACTS = 500",
  "FOUNDER_STARTER_MONTHLY_REPORTS = 3",
  "TOPUP_EXPIRY_DAYS = 60",
  "CONTACT_TOPUP_100_PRICE_USD = 15",
  "CONTACT_TOPUP_250_PRICE_USD = 35",
  "CONTACT_TOPUP_500_PRICE_USD = 65",
  "EXTRA_REPORT_1_PRICE_USD = 15",
  "EXTRA_REPORT_3_PRICE_USD = 39",
  "EXTRA_REPORT_EXPIRY_DAYS = 60",
  "REFERRAL_REWARD_CONTACTS = 100",
  "REFERRAL_REWARD_DELAY_DAYS = 14",
  "REFERRAL_REWARD_EXPIRY_DAYS = 60",
  "REFERRAL_MONTHLY_REWARD_LIMIT = 5",
  "REFERRAL_MILESTONE_PAID_USERS = 3",
  "REFERRAL_MILESTONE_REPORT_CREDITS = 1",
  'API_MIN_PLAN = "growth"',
  'GOOGLE_SHEETS_MIN_PLAN = "growth"',
  "PAID_REPORT_AFTER_CANCEL_RETENTION_DAYS = 30",
  "RISKSHIELD_GROWTH_RULES",
];

for (const needle of requiredConstants) {
  assert(rules.includes(needle), `Missing constant or export: ${needle}`);
}

const requiredDocSnippets = [
  "first 30 unique contacts",
  "500 contacts",
  "Growth",
  "Google Sheets",
  "Suppression List",
  "expires_at",
  "$0.1/contact",
  "noindex",
];

for (const needle of requiredDocSnippets) {
  assert(doc.includes(needle), `Missing doc snippet: ${needle}`);
}

assert(doc.includes("Free Preview"), "Missing Free Preview section");
assert(doc.includes("Small Campaign Risk Report"), "Missing Small Campaign Risk Report section");
assert(doc.includes("Founder Starter"), "Missing Founder Starter section");
assert(doc.includes("Top-up"), "Missing Top-up section");
assert(doc.includes("Referral"), "Missing Referral section");
assert(doc.includes("Security rules"), "Missing Security rules section");

console.log("Growth rules shape check passed.");
