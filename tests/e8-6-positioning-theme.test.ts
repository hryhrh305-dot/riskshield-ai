import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const home = read("src/components/home/HomePageClient.tsx");
const rootLayout = read("src/app/layout.tsx");
const globals = read("src/app/globals.css");
const themeToggle = read("src/components/theme/ThemeToggle.tsx");
const plans = read("src/lib/plans.ts");
const pricing = read("src/app/(dashboard)/pricing/page.tsx");
const dashboard = read("src/app/(dashboard)/dashboard/page.tsx");
const bulkCheck = read("src/app/(dashboard)/bulk-check/page.tsx");

describe("E8.6 positioning contract", () => {
  it("leads with the approved pre-send governance message", () => {
    expect(home).toContain("Second-line pre-send risk governance");
    expect(home).toContain("Approve high-value campaigns before the first send.");
    expect(home).toContain("Audit 50 Contacts Free");
    expect(home).toContain("View a Sample Audit");
    expect(home).toContain("Valid is not a launch decision.");
  });

  it("labels illustrative and future-state material honestly", () => {
    expect(home).toContain("Illustrative sample — not a real customer report");
    expect(home).toContain("Developing: signup and form-abuse review");
    expect(home).toContain("We do not guarantee inbox placement");
  });

  it("answers the launch-critical FAQ questions", () => {
    for (const question of [
      "Is Secwyn another email verifier?",
      "Does Secwyn guarantee inbox placement?",
      "What do Send, Review, and Suppress mean?",
      "Do Web, API, and Google Sheets return the same decision?",
      "What counts as one audit?",
      "Do downloads use additional credits?",
      "How does Secwyn handle unknown signals?",
      "Are the 50 free audits monthly?",
      "Which plans include API and Google Sheets access?",
      "Does Secwyn review signup or form abuse today?",
      "When does Secwyn use paid vendor data?",
    ]) {
      expect(home).toContain(question);
    }
  });

  it("preserves the approved plan capacities and price points", () => {
    expect(plans).toMatch(/starter:[\s\S]*?price:\s*49[\s\S]*?monthlyLimit:\s*500/);
    expect(plans).toMatch(/growth:[\s\S]*?price:\s*249[\s\S]*?monthlyLimit:\s*2500/);
    expect(plans).toMatch(/scale:[\s\S]*?price:\s*1499[\s\S]*?monthlyLimit:\s*15000/);
    expect(pricing).toContain("For one focused campaign or an independent advisory workflow.");
    expect(pricing).toContain("For specialists and firms managing multiple audit workflows.");
    expect(pricing).toContain("For organizations operating risk review at greater volume.");
  });
});

describe("E8.6 theme contract", () => {
  it("defaults new visitors to light before hydration while preserving saved choices", () => {
    expect(rootLayout).toContain("secwyn-theme-init");
    expect(rootLayout).toContain('strategy="beforeInteractive"');
    expect(rootLayout).toContain("secwyn-theme");
    expect(rootLayout).toMatch(/stored === "light" \|\| stored === "dark"[\s\S]*\? stored[\s\S]*: "light"/);
    expect(rootLayout).toContain('document.documentElement.dataset.theme = "light"');
    expect(rootLayout).not.toContain("prefers-color-scheme");
  });

  it("provides an accessible persistent toggle", () => {
    expect(themeToggle).toContain("secwyn-theme");
    expect(themeToggle).toContain("localStorage.setItem");
    expect(themeToggle).toContain("aria-label");
    expect(themeToggle).toContain("aria-pressed");
    expect(themeToggle).toContain('applyTheme("light")');
    expect(themeToggle).not.toContain("prefers-color-scheme");
  });

  it("defines a warm light palette without replacing the dark default", () => {
    expect(globals).toContain('html[data-theme="light"]');
    expect(globals).toContain("--rs-bg: #f5f1e8");
    expect(globals).toContain("--rs-accent: #0897a5");
    expect(globals).toContain(".rs-theme-toggle");
    expect(globals).toContain(":focus-visible");
    expect(globals).toMatch(/\n\.rs-marketing-title\s*\{[^}]*font-family: Georgia, "Times New Roman", serif;[^}]*font-weight: 500;[^}]*letter-spacing: -0\.045em;/s);
    expect(globals).not.toMatch(/html\[data-theme="light"\] \.rs-marketing-title\s*\{[^}]*font-family/s);
    expect(globals).toMatch(/article\.rs-pricing-growth\s*\{[^}]*border-color: #e7d4c6 !important;[^}]*background: #f6ede5 !important;[^}]*box-shadow: 0 10px 24px rgba\(80, 48, 28, 0\.08\) !important;/s);
    expect(globals).toMatch(/\.rs-pricing-popular-badge\s*\{[^}]*border-color: #dfc7b6 !important;[^}]*background: #fff8f2 !important;[^}]*color: #7a4e35 !important;/s);
    expect(dashboard).toContain("rs-referral-reward-copy");
    expect(dashboard).toContain("rs-referral-reward-example");
    expect(globals).toMatch(/\.rs-referral-reward-copy\s*\{[^}]*color: #1f6654 !important;/s);
    expect(globals).toMatch(/\.rs-referral-reward-example\s*\{[^}]*color: #3b6f61 !important;/s);
    expect(dashboard).toContain("rs-editorial-switch");
    expect(dashboard).toContain("rs-editorial-switch-label");
    expect(dashboard).toContain("rs-editorial-switch-thumb");
    expect(dashboard).toContain('role="switch"');
    expect(dashboard).toContain("aria-checked={enabled}");
    expect(globals).toMatch(/\.rs-editorial-switch\s*\{/);
    expect(globals).toMatch(/\.rs-editorial-switch\[aria-checked="true"\]\s*\{/);
    expect(globals).toMatch(/html\[data-theme="light"\][^}]*\.rs-editorial-switch/s);
    expect(bulkCheck).toContain("rs-bulk-plan-notice");
    expect(globals).toMatch(/\.rs-bulk-plan-notice\s*\{[^}]*color: #24527a !important;/s);
    expect(globals).toMatch(/\.rs-bulk-results-head th\s*\{[^}]*color: #f8fafc !important;/s);
  });
});

describe("E8.6 public claim guardrails", () => {
  it("does not expose forbidden legacy or unsupported launch claims", () => {
    const publicCopy = [
      read("src/app/page.tsx"),
      home,
      pricing,
      read("src/app/docs/page.tsx"),
      read("src/app/docs/google-sheets/page.tsx"),
      read("src/app/pre-send/page.tsx"),
    ].join("\n");

    expect(publicCopy).not.toMatch(/RiskShield|574269\.xyz|AI Risk Summary/i);
    expect(publicCopy).not.toMatch(/(?:we guarantee|secwyn guarantees|guaranteed) (?:inbox|delivery|revenue)/i);
    expect(publicCopy).not.toMatch(/30 free|100 free|5000 free|5,000 free/i);
  });
});
