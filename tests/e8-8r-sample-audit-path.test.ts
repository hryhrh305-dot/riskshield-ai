import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const home = read("src/components/home/HomePageClient.tsx");
const page = read("src/app/sample-audit/page.tsx");
const actions = read("src/components/sample-audit/SampleAuditActions.tsx");
const fixture = read("src/lib/sample-audit-data.ts");
const middleware = read("src/middleware.ts");
const login = read("src/app/(auth)/login/page.tsx");
const globals = read("src/app/globals.css");

describe("Phase B.6B sample audit conversion path", () => {
  it("uses a native Next link from the homepage to the public sample", () => {
    expect(home).toContain('href="/sample-audit"');
    expect(home).toContain("Explore a Sample Audit");
    expect(home).toContain('trackE8Event("sample_audit_home_cta_clicked"');
    expect(home).not.toContain('href="#sample-audit"');
  });

  it("keeps the sample route public and independent of protected product routes", () => {
    expect(page).toContain("See what a Secwyn audit delivers before you sign up");
    expect(page).toContain("No signup required");
    expect(page).toContain("Synthetic data only");
    expect(page).toContain("Does not consume credits");
    expect(middleware).not.toMatch(/protectedPaths[\s\S]*?["']\/sample-audit["']/);
    expect(middleware).not.toMatch(/matcher:[\s\S]*?["']\/sample-audit/);
  });

  it("ships exactly 20 synthetic results with the approved decision distribution", () => {
    expect(fixture).toContain("export const sampleAuditContacts");
    expect(fixture.match(/decision: "SEND"/g) ?? []).toHaveLength(9);
    expect(fixture.match(/decision: "REVIEW"/g) ?? []).toHaveLength(6);
    expect(fixture.match(/decision: "SUPPRESS"/g) ?? []).toHaveLength(5);
    expect(fixture.match(/@(?:[a-z0-9-]+\.)*(?:example\.com|example\.net|example\.org|example|invalid)/g) ?? []).toHaveLength(20);
    for (const reason of [
      "Role-based address",
      "No usable MX",
      "Possible domain typo",
      "Disposable mailbox",
      "Reserved or test domain",
      "Evidence unavailable",
    ]) {
      expect(fixture).toContain(reason);
    }
  });

  it("derives visible totals from the fixture and keeps all contact rows visible", () => {
    expect(page).toContain("sampleAuditContacts.length");
    expect(page).toContain("sampleAuditSummary");
    expect(page).toContain("sampleAuditContacts.map");
    expect(page).not.toMatch(/slice\s*\(/);
    expect(page).not.toMatch(/pagination|pageSize/i);
  });

  it("uses public decision language and explains evidence limits without guarantees", () => {
    for (const decision of ["SEND", "REVIEW", "SUPPRESS"]) expect(page).toContain(decision);
    expect(page).not.toMatch(/ALLOW:|BLOCK:/);
    expect(page).toContain("Evidence Limitations");
    expect(page).toContain("does not prove that a specific mailbox exists");
    expect(page).toContain("does not prove inbox placement");
    expect(page).toContain("should be reviewed before use");
  });

  it("routes sample CTAs safely and records the approved events", () => {
    expect(actions).toContain('"/signup?source=sample-audit"');
    expect(actions).toContain('"/risk-check"');
    expect(actions).toContain('href="/pricing"');
    expect(actions).toContain('trackE8Event("sample_audit_viewed"');
    expect(actions).toContain('trackE8Event("sample_audit_primary_cta_clicked"');
    expect(actions).toContain('trackE8Event("sample_audit_pricing_clicked"');
    expect(actions).not.toMatch(/bulk-check|create-checkout|product[_ -]?id|checkout/i);
  });

  it("does not call audit APIs, consume credits, or persist sample results", () => {
    const sampleCode = `${page}\n${actions}\n${fixture}`;
    expect(sampleCode).not.toMatch(/\/api\/(?:v1\/email|email\/batch-check|bulk-check|create-checkout)/);
    expect(sampleCode).not.toMatch(/consume_credit|reserve_credit|supabase\.from|\.insert\(|\.upsert\(/i);
    expect(page).toContain("Demo credit usage");
    expect(page).toContain("None");
  });

  it("publishes noindex metadata and the required disclaimer", () => {
    expect(page).toContain("Sample Contact Risk Audit | Secwyn");
    expect(page).toContain("robots: { index: false, follow: true }");
    expect(page).toContain("This sample uses synthetic contacts for demonstration.");
  });
});

describe("email confirmation notice contrast", () => {
  it("uses a dedicated light-theme color instead of pale blue utility text", () => {
    expect(login).toContain("rs-auth-info-message");
    expect(globals).toMatch(/html\[data-theme="light"\][^}]*\.rs-auth-info-message\s*\{[^}]*color:\s*#[0-9a-f]{6}/s);
  });
});
