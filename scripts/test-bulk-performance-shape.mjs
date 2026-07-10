import fs from "node:fs";

const files = [
  "src/app/api/bulk-check/route.ts",
  "src/app/api/v1/email/batch-check/route.ts",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  const creditIndex = source.indexOf("const legacyCreditResult = await consumeLegacyCredits");
  const cacheIndex = source.indexOf("const cached = getCachedResult");
  const riskIndex = source.indexOf("calculateRiskScore({");
  const sharedAgeIndex = source.indexOf("getSharedDomainAge");
  const sharedDnsIndex = source.indexOf("getSharedDNSHealth");

  assert(creditIndex !== -1, `${file}: legacy credit deduction path is missing`);
  assert(cacheIndex !== -1, `${file}: result cache check is missing`);
  assert(riskIndex !== -1, `${file}: risk calculation is missing`);
  assert(creditIndex < cacheIndex, `${file}: cache check must remain after credit deduction`);
  assert(cacheIndex < riskIndex, `${file}: cache check must happen before expensive risk checks`);
  assert(sharedAgeIndex !== -1, `${file}: request-scoped domain age memo is missing`);
  assert(sharedDnsIndex !== -1, `${file}: request-scoped DNS health memo is missing`);
  assert(!source.includes("consume_ledger_credits"), `${file}: must not introduce ledger credit deduction`);
  assert(!source.includes("credit_grants"), `${file}: must not introduce credit grant logic`);
}

console.log("bulk performance shape checks passed");
