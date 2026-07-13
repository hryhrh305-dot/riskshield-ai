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
const accounting = read("src/lib/credit-accounting.ts");
const bulkRoute = read("src/app/api/bulk-check/route.ts");
const webRiskRoute = read("src/app/api/web-risk/route.ts");
const batchApiRoute = read("src/app/api/v1/email/batch-check/route.ts");

assert(helper.includes("export async function consumeLegacyCredits"), "legacy helper must export consumeLegacyCredits");
assert(accounting.includes('rpc("consume_grant_credits"'), "credit adapter must use atomic consume_grant_credits RPC");
assert(helper.includes("creditsRemaining"), "legacy helper must track post-deduction credits remaining");
assert(accounting.includes("Array.isArray(data)"), "credit adapter must support array or object RPC return shapes");
assert(accounting.includes("CONSUME_CREDIT_RPC_FAILED"), "credit adapter must fail closed on malformed RPC data");
assert(!helper.includes("for (let i = 0; i < safeRequiredCredits"), "legacy helper must not partially deduct in a loop");
assert(helper.includes("requestFingerprint"), "legacy helper must bind idempotency to the business payload");
assert(!helper.includes("credit_grants"), "legacy helper must not wire credit_grants");
assert(!helper.includes("credit_usage"), "legacy helper must not wire credit_usage");
assert(helper.includes("consumeContactCredits"), "legacy helper must delegate to the atomic accounting adapter");
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
