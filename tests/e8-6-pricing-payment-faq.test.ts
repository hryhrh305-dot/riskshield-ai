import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pricing = readFileSync("src/app/(dashboard)/pricing/page.tsx", "utf8");
const plans = readFileSync("src/lib/plans.ts", "utf8");

describe("E8.6 pricing payment clarification", () => {
  it("explains USD billing and qualified international checkout availability", () => {
    expect(pricing).toContain("What currency are Secwyn plans billed in?");
    expect(pricing).toContain("Can customers in Europe pay for Secwyn?");
    expect(pricing).toContain("listed and charged in U.S. dollars (USD)");
    expect(pricing).toContain("shown by Creem at checkout");
    expect(pricing).toContain("You do not need a U.S. bank card or a separate USD account.");
  });

  it("qualifies payment methods, conversion fees, and taxes without guarantees", () => {
    for (const qualifier of [
      "location, billing address, device, product type, and price",
      "your payment provider may convert the USD charge",
      "Secwyn does not set or collect those conversion fees",
      "Creem handles applicable taxes as the Merchant of Record",
    ]) {
      expect(pricing).toContain(qualifier);
    }

    expect(pricing).not.toMatch(/every European card is accepted/i);
    expect(pricing).not.toMatch(/all European customers can always pay/i);
    expect(pricing).not.toMatch(/no conversion fee/i);
    expect(pricing).not.toMatch(/supports USD and EUR checkout/i);
    expect(pricing).not.toMatch(/always (?:shown|charged|billed) in (?:your )?local currency/i);
  });

  it("uses the native accessible disclosure pattern", () => {
    expect(pricing).toContain('className="rs-app relative min-h-screen overflow-x-clip"');
    expect(pricing).toContain('<section id="payment-faq"');
    expect(pricing.match(/<details/g)).toHaveLength(4);
    expect(pricing.match(/<summary/g)).toHaveLength(4);
    expect(pricing).toContain('aria-hidden="true"');
  });

  it("preserves the approved public plan prices and capacities", () => {
    expect(plans).toMatch(/free:[\s\S]*?price:\s*0[\s\S]*?monthlyLimit:\s*50/);
    expect(plans).toMatch(/starter:[\s\S]*?price:\s*49[\s\S]*?monthlyLimit:\s*500/);
    expect(plans).toMatch(/growth:[\s\S]*?price:\s*249[\s\S]*?monthlyLimit:\s*2500/);
    expect(plans).toMatch(/scale:[\s\S]*?price:\s*1499[\s\S]*?monthlyLimit:\s*15000/);
  });
});
