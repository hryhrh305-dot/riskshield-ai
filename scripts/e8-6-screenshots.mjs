import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.E8_6_BASE_URL || "http://127.0.0.1:3106";
const outputDir = "docs/e8-6/screenshots";

const captures = [
  ["home-dark-desktop.png", "/", "dark", { width: 1440, height: 1000 }],
  ["home-light-desktop.png", "/", "light", { width: 1440, height: 1000 }],
  ["home-dark-mobile.png", "/", "dark", { width: 390, height: 844 }],
  ["home-light-mobile.png", "/", "light", { width: 390, height: 844 }],
  ["pricing-dark-desktop.png", "/pricing", "dark", { width: 1440, height: 1000 }],
  ["pricing-light-desktop.png", "/pricing", "light", { width: 1440, height: 1000 }],
  ["login-dark-desktop.png", "/login", "dark", { width: 1280, height: 900 }],
  ["login-light-desktop.png", "/login", "light", { width: 1280, height: 900 }],
  ["not-found-light-desktop.png", "/e8-6-intentional-404", "light", { width: 1280, height: 900 }],
  ["dashboard-auth-boundary-dark.png", "/dashboard", "dark", { width: 1280, height: 900 }],
  ["dashboard-auth-boundary-light.png", "/dashboard", "light", { width: 1280, height: 900 }],
  ["bulk-check-auth-boundary-dark.png", "/bulk-check", "dark", { width: 1280, height: 900 }],
  ["bulk-check-auth-boundary-light.png", "/bulk-check", "light", { width: 1280, height: 900 }],
  ["risk-check-auth-boundary-dark.png", "/risk-check", "dark", { width: 1280, height: 900 }],
  ["risk-check-auth-boundary-light.png", "/risk-check", "light", { width: 1280, height: 900 }],
];

const smokePaths = [
  "/",
  "/pricing",
  "/docs",
  "/docs/google-sheets",
  "/pre-send",
  "/bulk-check",
  "/risk-check",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/admin/e8",
  "/blacklist",
  "/e8-6-intentional-404",
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  for (const [file, path, theme, viewport] of captures) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((selectedTheme) => {
      localStorage.setItem("secwyn-theme", selectedTheme);
    }, theme);
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(900);
    const appliedTheme = await page.locator("html").getAttribute("data-theme");
    const toggle = page.locator(".rs-theme-toggle");
    if (appliedTheme !== theme) throw new Error(`${file}: expected ${theme}, received ${appliedTheme}`);
    if (await toggle.count() !== 1) throw new Error(`${file}: theme toggle is missing or duplicated`);
    if (await toggle.getAttribute("aria-pressed") !== String(theme === "light")) {
      throw new Error(`${file}: theme toggle state is not accessible`);
    }
    if (file === "home-light-desktop.png") {
      await toggle.click();
      if (await page.locator("html").getAttribute("data-theme") !== "dark") {
        throw new Error(`${file}: theme toggle did not switch to dark`);
      }
      if (await page.evaluate(() => localStorage.getItem("secwyn-theme")) !== "dark") {
        throw new Error(`${file}: theme choice was not persisted`);
      }
      await toggle.click();
    }
    if (runtimeErrors.some((message) => /hydration|uncaught|cannot read|typeerror/i.test(message))) {
      throw new Error(`${file}: runtime error: ${runtimeErrors.join(" | ")}`);
    }
    await page.screenshot({ path: `${outputDir}/${file}`, fullPage: true });
    console.log(`${file}\t${page.url()}\ttheme=${appliedTheme}\truntimeErrors=${runtimeErrors.length}`);
    await context.close();
  }

  for (const systemTheme of ["dark", "light"]) {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      colorScheme: systemTheme,
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const appliedTheme = await page.locator("html").getAttribute("data-theme");
    if (appliedTheme !== systemTheme) {
      throw new Error(`system ${systemTheme}: received ${appliedTheme}`);
    }
    console.log(`system-fallback\t${systemTheme}\tPASS`);
    await context.close();
  }

  const smokeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const path of smokePaths) {
    const page = await smokeContext.newPage();
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(400);
    if (!response || ![200, 404].includes(response.status())) {
      throw new Error(`smoke ${path}: unexpected status ${response?.status() ?? "none"}`);
    }
    if (await page.locator(".rs-theme-toggle").count() !== 1) {
      throw new Error(`smoke ${path}: missing theme toggle`);
    }
    if (path === "/") {
      for (const href of ["#workflow", "#sample-audit", "/docs", "/pricing", "/login", "/signup", "/privacy", "/terms", "mailto:support@secwyn.com"]) {
        if (await page.locator(`a[href="${href}"]`).count() === 0) {
          throw new Error(`home link check: missing ${href}`);
        }
      }
    }
    console.log(`smoke\t${path}\t${response.status()}\t${page.url()}`);
    await page.close();
  }
  await smokeContext.close();
} finally {
  await browser.close();
}
