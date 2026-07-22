import { chromium } from "@playwright/test";

const baseUrl = process.env.AFFILIATE_PREVIEW_BASE_URL;
const password = process.env.AFFILIATE_E2E_PASSWORD;

if (!baseUrl?.startsWith("https://")) throw new Error("AFFILIATE_PREVIEW_BASE_URL_REQUIRED");
if (!password) throw new Error("AFFILIATE_E2E_PASSWORD_REQUIRED");

const checks = [];
const record = (name, pass, detail = "") => {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(`${name}: ${detail}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { context, page, pageErrors };
}

async function login(page, email) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const authResponse = page.waitForResponse((response) => response.url().includes("/auth/v1/token?grant_type=password"), { timeout: 30_000 });
  await page.getByRole("button", { name: "Sign In" }).click();
  const response = await authResponse;
  if (!response.ok()) throw new Error(`AFFILIATE_E2E_LOGIN_FAILED:${response.status()}`);
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
}

async function assertNoOverflow(page, name) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record(name, result.scrollWidth <= result.clientWidth + 1, JSON.stringify(result));
}

try {
  {
    const { context, page, pageErrors } = await newPage();
    console.log("[e2e] public desktop");
    const response = await page.goto(`${baseUrl}/affiliate/india`, { waitUntil: "domcontentloaded" });
    record("public_affiliate_200", response?.status() === 200, String(response?.status()));
    record("public_affiliate_truth_copy", (await page.locator("body").innerText()).includes("India Affiliate"));
    await assertNoOverflow(page, "public_desktop_no_overflow");
    await page.goto(`${baseUrl}/affiliate/india/apply`, { waitUntil: "domcontentloaded" });
    record("application_requires_auth", page.url().includes("/login"), page.url());
    record("public_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage({ width: 390, height: 844 });
    console.log("[e2e] public mobile");
    await page.goto(`${baseUrl}/affiliate/india`, { waitUntil: "domcontentloaded" });
    await assertNoOverflow(page, "public_mobile_no_overflow");
    record("public_mobile_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "applicant@preview.secwyn.invalid");
    console.log("[e2e] applicant");
    await page.goto(`${baseUrl}/affiliate/india/apply`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Professional background").fill("Synthetic Preview operations acceptance applicant.");
    await page.getByLabel("How will you promote Secwyn?").fill("Consent-aware, approved-content-only Preview acceptance workflow.");
    await page.locator('select[name="quiz_relationship"]').selectOption("independent");
    await page.locator('select[name="quiz_disclosure"]').selectOption("always");
    await page.locator('select[name="quiz_outreach"]').selectOption("consent");
    await page.locator('select[name="quiz_claims"]').selectOption("evidence");
    await page.locator('select[name="quiz_stop"]').selectOption("stop");
    await page.locator('input[name="independent_disclosure"]').check();
    await page.locator('input[name="anti_spam"]').check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await page.waitForURL("**/affiliate/portal", { timeout: 30_000 });
    const text = await page.locator("body").innerText();
    record("application_submitted", text.includes("Application received"), text.slice(0, 240));
    record("application_quiz_passed", text.includes("5/5") && text.includes("passed"), text.slice(0, 300));
    await page.goto(`${baseUrl}/admin/affiliate`, { waitUntil: "domcontentloaded" });
    record("applicant_admin_denied", page.url().includes("/dashboard"), page.url());
    record("applicant_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "provisional@preview.secwyn.invalid");
    console.log("[e2e] provisional");
    await page.goto(`${baseUrl}/affiliate/portal`, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    record("provisional_status_visible", text.toLowerCase().includes("provisional"));
    record("provisional_activation_progress", text.includes("2/3 valid actions") && text.includes("2/2 formats"));
    record("provisional_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "approved-a@preview.secwyn.invalid");
    console.log("[e2e] approved A");
    await page.goto(`${baseUrl}/affiliate/portal`, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    record("approved_badge_visible", text.toLowerCase().includes("india founding affiliate"));
    record("direct_relationship_privacy", text.includes("Direct relationships only") && text.includes("Downstream private data") && !text.includes("Affiliate C Synthetic"));
    record("synthetic_payout_not_real", text.includes("Payout readiness") && text.includes("Not configured"));
    await assertNoOverflow(page, "approved_desktop_no_overflow");
    record("approved_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "admin@preview.secwyn.invalid");
    console.log("[e2e] admin");
    await page.goto(`${baseUrl}/admin/affiliate`, { waitUntil: "domcontentloaded" });
    const adminText = await page.locator("body").innerText();
    record("admin_control_center", adminText.includes("Affiliate control center") && adminText.includes("Application review queue"));
    record("admin_danger_gates_visible", adminText.includes("Kill Switch & payout gate") && adminText.includes("Real commission and payout stay closed"));
    await page.goto(`${baseUrl}/admin/affiliate/content`, { waitUntil: "domcontentloaded" });
    const contentText = await page.locator("body").innerText();
    record("admin_content_library", contentText.includes("Content library") && contentText.includes("Content lifecycle"));
    record("admin_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "content@preview.secwyn.invalid");
    console.log("[e2e] content operator");
    await page.goto(`${baseUrl}/admin/affiliate/content`, { waitUntil: "domcontentloaded" });
    record("content_operator_allowed", (await page.locator("body").innerText()).includes("Content library"));
    await page.goto(`${baseUrl}/admin/affiliate`, { waitUntil: "domcontentloaded" });
    record("content_operator_admin_denied", page.url().includes("/dashboard"), page.url());
    record("content_operator_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  {
    const { context, page, pageErrors } = await newPage();
    await login(page, "reviewer@preview.secwyn.invalid");
    console.log("[e2e] reviewer");
    await page.goto(`${baseUrl}/admin/affiliate/content`, { waitUntil: "domcontentloaded" });
    record("reviewer_content_allowed", (await page.locator("body").innerText()).includes("Content library"));
    record("reviewer_no_page_errors", pageErrors.length === 0, pageErrors.join(" | "));
    await context.close();
  }

  console.log(JSON.stringify({ ok: true, checks }, null, 2));
} finally {
  await browser.close();
}
