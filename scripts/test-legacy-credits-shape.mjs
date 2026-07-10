import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const helper = read("src/lib/legacy-credits.ts");
const bulkRoute = read("src/app/api/bulk-check/route.ts");
const webRiskRoute = read("src/app/api/web-risk/route.ts");
const batchApiRoute = read("src/app/api/v1/email/batch-check/route.ts");

assert(helper.includes("export async function consumeLegacyCredits"), "legacy helper must export consumeLegacyCredits");
assert(helper.includes('rpc("consume_credit"'), "legacy helper must use the existing consume_credit RPC");
assert(helper.includes("creditsRemaining"), "legacy helper must track post-deduction credits remaining");
assert(helper.includes("Array.isArray(creditResult)"), "legacy helper must support array or object RPC return shapes");
assert(helper.includes("CREDIT_DEDUCTION_NOT_CONFIRMED"), "legacy helper must fail closed when deduction is not confirmed");
assert(helper.includes("confirmedRemaining"), "legacy helper must verify final profile balance after RPC deduction");
assert(!helper.includes("credit_grants"), "legacy helper must not wire credit_grants");
assert(!helper.includes("credit_usage"), "legacy helper must not wire credit_usage");
assert(!helper.includes("consumeLedgerCredits"), "legacy helper must not wire consumeLedgerCredits");
assert(!helper.includes(".update({ credits_remaining"), "legacy helper must not manually update profiles.credits_remaining");

for (const [name, source] of [
  ["bulk-check", bulkRoute],
  ["web-risk", webRiskRoute],
  ["v1/email/batch-check", batchApiRoute],
]) {
  assert(source.includes("consumeLegacyCredits"), `${name} must use consumeLegacyCredits`);
  assert(source.includes("legacyCreditResult.creditsRemaining"), `${name} must return post-deduction credits remaining`);
}

assert(!bulkRoute.includes('rpc("consume_credit"'), "bulk-check must not call consume_credit directly");
assert(!webRiskRoute.includes('rpc("consume_credit"'), "web-risk must not call consume_credit directly");
assert(!batchApiRoute.includes('rpc("consume_credit"'), "batch API must not call consume_credit directly");
assert(!batchApiRoute.includes(".update({ credits_remaining"), "batch API must not manually decrement credits_remaining");
assert(batchApiRoute.includes('from("usage_ledger").insert'), "batch API may retain usage_ledger as analytics");
assert(batchApiRoute.includes("usage ledger as API analytics only"), "batch API must document usage_ledger as analytics only");

console.log("Legacy credit deduction shape checks passed.");
