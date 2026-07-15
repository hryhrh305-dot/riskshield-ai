import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "@playwright/test";
import ts from "typescript";

const baseUrl = process.env.E8_7_BASE_URL || "http://127.0.0.1:3105";
const outputDir = "docs/e8-7/screenshots";
const tempDir = ".codex-temp";
const compiledReport = path.join(tempDir, "e8-7-report-format.cjs");

await mkdir(outputDir, { recursive: true });
await mkdir(tempDir, { recursive: true });
const reportSource = await readFile("src/lib/audit/report-format.ts", "utf8");
await writeFile(compiledReport, ts.transpileModule(reportSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, "utf8");
const require = createRequire(import.meta.url);
const { buildAuditReportModel, buildClientReportHtml } = require(path.resolve(compiledReport));

function makeResult(index, decision = "REVIEW", state = {}) {
  const queue = decision === "ALLOW" ? "send" : decision === "BLOCK" ? "suppress" : "review";
  const reasonCode = decision === "ALLOW" ? "BASE_SCORE_ALLOW" : decision === "BLOCK" ? "DISPOSABLE_DOMAIN" : "MAILBOX_UNCONFIRMED";
  return {
    email: `fixture.${String(index).padStart(3, "0")}@example.invalid`,
    normalized_email: `fixture.${String(index).padStart(3, "0")}@example.invalid`,
    decision,
    risk_score: decision === "ALLOW" ? 18 : decision === "BLOCK" ? 82 : 42,
    primary_reason_code: reasonCode,
    primary_reason: decision === "ALLOW" ? "Base score allows sending" : decision === "BLOCK" ? "Disposable or temporary domain" : "Mailbox unconfirmed",
    recommended_action: queue === "send" ? "Proceed with normal campaign controls." : queue === "suppress" ? "Keep this contact out of the current campaign." : "Review this contact before launch.",
    decision_explanation: "Deterministic fixture explanation.",
    mx_status: "present",
    mailbox_status: decision === "BLOCK" ? "rejected" : "unconfirmed",
    catch_all_status: "not_tested",
    disposable: decision === "BLOCK",
    role_based: false,
    engine_version: "secwyn-decision-integrity-v1",
    policy_rules_version: "secwyn-signal-snapshot-v1",
    audit_id: `fixture-audit-${index}`,
    audited_at: "2026-07-15T08:00:00.000Z",
    ...state,
  };
}

function makeSummary(results, totalOverride) {
  const sendCount = results.filter((item) => item.decision === "ALLOW").length;
  const reviewCount = results.filter((item) => item.decision === "REVIEW").length;
  const suppressCount = results.filter((item) => item.decision === "BLOCK").length;
  const total = totalOverride ?? results.length;
  return {
    total,
    sendCount,
    reviewCount,
    suppressCount,
    sendRate: total ? sendCount / total : 0,
    reviewRate: total ? reviewCount / total : 0,
    suppressRate: total ? suppressCount / total : 0,
    campaignReadinessScore: 0,
    launchStatus: "launch_with_caution",
    listAcceptance: "accept_after_cleanup",
    topRiskReasons: [],
    topDecisionDrivers: [],
    estimatedWastePrevented: {},
    recommendedWorkflow: [],
    clientRiskBrief: "",
  };
}

function reportHtml(results, options = {}) {
  const reconciliation = {
    inputRows: options.inputRows ?? results.length,
    syntaxAccepted: options.syntaxAccepted ?? results.length,
    rejectedBeforeScreening: options.rejected ?? 0,
    duplicatesRemoved: options.duplicates ?? 0,
    uniqueValidAddressesProcessed: results.length,
    resultsProduced: results.length,
    creditsConsumed: results.length,
    rows: results.map((item, index) => ({ rowNumber: index + 1, originalValue: item.email, normalizedValue: item.email })),
  };
  const model = buildAuditReportModel({ summary: makeSummary(results, options.summaryTotal), results, reconciliation, generatedAt: new Date("2026-07-15T09:00:00.000Z") });
  return buildClientReportHtml(model);
}

const mixed = [
  ...Array.from({ length: 6 }, (_, index) => makeResult(index + 1, "ALLOW")),
  ...Array.from({ length: 3 }, (_, index) => makeResult(index + 7, "REVIEW")),
  makeResult(10, "BLOCK"),
];
const scenarios = [
  ["actual-report-mixed-desktop.png", reportHtml(mixed, { inputRows: 12, syntaxAccepted: 11, rejected: 1, duplicates: 1 }), { width: 1440, height: 1000 }, false],
  ["actual-report-mixed-mobile.png", reportHtml(mixed, { inputRows: 12, syntaxAccepted: 11, rejected: 1, duplicates: 1 }), { width: 390, height: 844 }, false],
  ["actual-report-all-send.png", reportHtml(Array.from({ length: 10 }, (_, index) => makeResult(index + 1, "ALLOW"))), { width: 1280, height: 900 }, false],
  ["actual-report-all-review.png", reportHtml(Array.from({ length: 10 }, (_, index) => makeResult(index + 1, "REVIEW"))), { width: 1280, height: 900 }, false],
  ["actual-report-all-suppress.png", reportHtml(Array.from({ length: 10 }, (_, index) => makeResult(index + 1, "BLOCK"))), { width: 1280, height: 900 }, false],
  ["actual-report-empty.png", reportHtml([]), { width: 1280, height: 900 }, false],
  ["actual-report-partial.png", reportHtml(mixed.slice(0, 5), { summaryTotal: 10 }), { width: 1280, height: 900 }, false],
  ["actual-report-lookup-failed.png", reportHtml([makeResult(1, "REVIEW", { mx_status: "lookup_failed", mailbox_status: "unknown", catch_all_status: "lookup_failed" })]), { width: 1280, height: 900 }, false],
  ["actual-report-500-contact-fixture.png", reportHtml(Array.from({ length: 500 }, (_, index) => makeResult(index + 1, index % 8 === 0 ? "BLOCK" : index % 3 === 0 ? "REVIEW" : "ALLOW"))), { width: 1440, height: 1000 }, false],
  ["print-pdf-preview.png", reportHtml(mixed), { width: 1280, height: 900 }, true],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [file, html, viewport, print] of scenarios) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    if (print) await page.emulateMedia({ media: "print" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth && innerWidth <= 720);
    if (overflow) throw new Error(`${file}: mobile horizontal overflow`);
    await page.screenshot({ path: `${outputDir}/${file}`, fullPage: file !== "actual-report-500-contact-fixture.png" });
    console.log(`${file}\tfixture-report\toverflow=${overflow}`);
    await context.close();
  }

  const routeCaptures = [
    ["bulk-auth-boundary-dark.png", "/bulk-check", "dark"],
    ["bulk-auth-boundary-light.png", "/bulk-check", "light"],
    ["single-auth-boundary-dark.png", "/risk-check", "dark"],
    ["single-auth-boundary-light.png", "/risk-check", "light"],
    ["history-auth-boundary-dark.png", "/pre-send", "dark"],
    ["history-auth-boundary-light.png", "/pre-send", "light"],
    ["homepage-sample-light.png", "/#sample-audit", "light"],
  ];
  for (const [file, route, theme] of routeCaptures) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem("secwyn-theme", value), theme);
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (runtimeErrors.length) throw new Error(`${file}: ${runtimeErrors.join(" | ")}`);
    await page.screenshot({ path: `${outputDir}/${file}`, fullPage: true });
    console.log(`${file}\t${page.url()}\ttheme=${await page.locator("html").getAttribute("data-theme")}`);
    await context.close();
  }

  const publicRoutes = ["/", "/pricing", "/docs", "/docs/google-sheets", "/login"];
  for (const route of publicRoutes) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response?.ok()) throw new Error(`${route}: HTTP ${response?.status() ?? "no response"}`);
    if (runtimeErrors.length) throw new Error(`${route}: ${runtimeErrors.join(" | ")}`);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (horizontalOverflow) throw new Error(`${route}: horizontal document overflow`);
    console.log(`${route}\tpublic-smoke\tstatus=${response.status()}\toverflow=${horizontalOverflow}`);
    await context.close();
  }
} finally {
  await browser.close();
}
