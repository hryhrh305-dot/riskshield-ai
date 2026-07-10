import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const visibleBrandFiles = [
  "google-sheets-addon/Code.gs",
  "google-sheets-addon/README.md",
  "src/app/api/google-sheets-addon/route.ts",
  "src/app/docs/page.tsx",
  "src/app/docs/google-sheets/page.tsx",
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/bulk-check/page.tsx",
  "src/app/api/bulk-check/route.ts",
];

const oldBrandPattern = /RiskShield AI|RiskShield|riskshield|rishkshield|574269\.xyz|574269/i;

for (const file of visibleBrandFiles) {
  const text = readFileSync(path.join(root, file), "utf8");
  assert.equal(oldBrandPattern.test(text), false, `${file} still contains old brand or old domain text`);
}

const docsText = readFileSync(path.join(root, "src/app/docs/page.tsx"), "utf8");
const sheetsText = readFileSync(path.join(root, "src/app/docs/google-sheets/page.tsx"), "utf8");
const dashboardText = readFileSync(path.join(root, "src/app/(dashboard)/dashboard/page.tsx"), "utf8");

assert.match(docsText, /https:\/\/www\.secwyn\.com\/api\/v1\/email\/check/, "API docs should use the Secwyn production base URL");
assert.match(docsText, /API access is available on Growth and above/, "API docs should state Growth+ access");
assert.match(sheetsText, /requires a Growth, Scale, or Business plan/, "Sheets docs should state eligible plan access");
assert.match(dashboardText, /API access starts on Growth/, "Dashboard API card should keep Growth+ gating copy");
assert.match(dashboardText, /Secwyn API key/, "Dashboard Sheets card should reference Secwyn API key");

console.log("Brand residue shape test passed.");
