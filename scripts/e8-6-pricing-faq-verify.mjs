import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.E8_6_BASE_URL || "http://127.0.0.1:3106";
const outputDir = "docs/e8-6/screenshots";
const captures = [
  ["pricing-faq-dark-desktop.png", "dark", { width: 1440, height: 1000 }],
  ["pricing-faq-light-desktop.png", "light", { width: 1440, height: 1000 }],
  ["pricing-faq-dark-mobile.png", "dark", { width: 390, height: 844 }],
  ["pricing-faq-light-mobile.png", "light", { width: 390, height: 844 }],
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  for (const [file, theme, viewport] of captures) {
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

    await page.goto(`${baseUrl}/pricing#payment-faq`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(500);

    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      throw new Error(`${file}: expected ${theme} theme`);
    }

    const faq = page.locator("#payment-faq");
    const details = faq.locator("details");
    const summaries = faq.locator("summary");
    if (await details.count() !== 2 || await summaries.count() !== 2) {
      throw new Error(`${file}: expected two native FAQ disclosures`);
    }

    await summaries.first().focus();
    await page.keyboard.press("Enter");
    if (!(await details.first().evaluate((element) => element.open))) {
      throw new Error(`${file}: keyboard did not open the first FAQ`);
    }
    await page.keyboard.press("Enter");
    if (await details.first().evaluate((element) => element.open)) {
      throw new Error(`${file}: keyboard did not close the first FAQ`);
    }
    await page.keyboard.press("Enter");

    const pageText = (await page.locator("body").textContent()) || "";
    for (const required of [
      "listed and charged in U.S. dollars (USD)",
      "shown by Creem at checkout",
      "You do not need a U.S. bank card or a separate USD account.",
      "Creem handles applicable taxes as the Merchant of Record.",
    ]) {
      if (!pageText.includes(required)) throw new Error(`${file}: missing required copy: ${required}`);
    }
    for (const forbidden of [
      /every European card is accepted/i,
      /all European customers can always pay/i,
      /no conversion fee/i,
      /supports USD and EUR checkout/i,
    ]) {
      if (forbidden.test(pageText)) throw new Error(`${file}: forbidden payment guarantee found`);
    }

    const faqHasHorizontalOverflow = await faq.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    if (faqHasHorizontalOverflow) throw new Error(`${file}: FAQ has horizontal overflow`);
    const horizontalScroll = await page.evaluate(() => {
      window.scrollTo(10_000, window.scrollY);
      const position = window.scrollX;
      window.scrollTo(0, window.scrollY);
      const app = document.querySelector(".rs-app");
      const main = document.querySelector("main");
      const table = document.querySelector("table");
      const scroller = table?.parentElement;
      const tableSection = scroller?.parentElement;
      return {
        position,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        appWidth: app?.getBoundingClientRect().width,
        mainWidth: main?.getBoundingClientRect().width,
        tableWidth: table?.getBoundingClientRect().width,
        scrollerWidth: scroller?.getBoundingClientRect().width,
        scrollerScrollWidth: scroller?.scrollWidth,
        scrollerOverflowX: scroller ? getComputedStyle(scroller).overflowX : null,
        tableSectionWidth: tableSection?.getBoundingClientRect().width,
        tableSectionOverflowX: tableSection ? getComputedStyle(tableSection).overflowX : null,
        overflowingElements: [...document.querySelectorAll("body *")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: String(element.className).slice(0, 100),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((element) => element.right > document.documentElement.clientWidth + 1)
          .slice(0, 12),
      };
    });
    if (horizontalScroll.position > 1) {
      throw new Error(`${file}: page can scroll horizontally: ${JSON.stringify(horizontalScroll)}`);
    }
    if (runtimeErrors.some((message) => /hydration|uncaught|cannot read|typeerror/i.test(message))) {
      throw new Error(`${file}: runtime error: ${runtimeErrors.join(" | ")}`);
    }

    await faq.scrollIntoViewIfNeeded();
    await faq.screenshot({ path: `${outputDir}/${file}` });
    console.log(`${file}\ttheme=${theme}\tkeyboard=PASS\toverflow=PASS`);
    await context.close();
  }
} finally {
  await browser.close();
}
