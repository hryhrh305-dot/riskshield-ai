import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function forbiddenPhrase(...parts) {
  return parts.join("");
}

const meRoutePath = "src/app/api/referrals/me/route.ts";
const attributeRoutePath = "src/app/api/referrals/attribute/route.ts";
const dashboardPath = "src/app/(dashboard)/dashboard/page.tsx";
const signupPath = "src/app/(auth)/signup/page.tsx";
const migrationDir = "supabase/migrations";

assert(fs.existsSync(meRoutePath), "GET /api/referrals/me route is missing");
assert(fs.existsSync(attributeRoutePath), "POST /api/referrals/attribute route is missing");

const referralApiSource = [meRoutePath, attributeRoutePath].map(read).join("\n");
const referralUiSource = [dashboardPath, signupPath].map(read).join("\n");
const referralSource = [referralApiSource, referralUiSource].join("\n");
const dashboard = read(dashboardPath);
const signup = read(signupPath);

assert(dashboard.includes("Invite & Earn Bonus Checks"), "dashboard referral card title is missing");
assert(dashboard.includes("30-day eligibility period"), "dashboard must mention the eligibility review period");
assert(dashboard.includes("60 days"), "dashboard must mention bonus check expiry");
assert(dashboard.includes("No hard monthly cap"), "dashboard must mention no hard monthly cap");
assert(signup.includes("secwyn_referral_code"), "signup ref capture is missing");
assert(signup.includes("localStorage"), "signup ref capture should persist locally");

assert(!referralSource.includes(forbiddenPhrase("monthly cap", " = ", "5")), "referral code must not add a hard monthly limit");
assert(!referralSource.includes(forbiddenPhrase("14-day ", "refund window")), "referral copy must not mention the shorter refund-window phrase");
assert(!referralSource.includes(forbiddenPhrase("30-day ", "refund window")), "referral copy must not mention the longer refund-window phrase");
assert(!referralSource.includes(forbiddenPhrase("guaranteed ", "refund")), "referral copy must not imply a promised refund");
assert(!referralSource.includes(forbiddenPhrase("consume", "_credit")), "referral code must not call legacy credit deduction");
assert(!referralSource.includes(forbiddenPhrase("consume", "_ledger", "_credits")), "referral code must not call ledger credit deduction");
assert(!referralApiSource.includes(forbiddenPhrase("credits", "_remaining")), "referral API code must not modify the legacy balance field");
assert(!referralSource.includes(forbiddenPhrase("100 ", "credits")), "referral code must not change the new-user default credit amount");

const migrations = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((file) => file.includes("referral"))
  : [];
assert(migrations.length > 0, "referral migration file is missing");

for (const file of migrations) {
  const migration = read(path.join(migrationDir, file));
  assert(migration.includes("referral_codes"), `${file}: referral_codes table is missing`);
  assert(migration.includes("referral_attributions"), `${file}: referral_attributions table is missing`);
  assert(!migration.includes(forbiddenPhrase("credits", "_remaining")), `${file}: migration must not touch the legacy balance field`);
}

console.log("referral shape checks passed");
