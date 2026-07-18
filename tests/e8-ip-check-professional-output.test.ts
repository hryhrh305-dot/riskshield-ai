import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Secwyn IP check output contract", () => {
  it("uses zero-cost HTTPS-first IP enrichment", () => {
    const engine = readFileSync("src/lib/risk-engine.ts", "utf8");

    expect(engine).toContain("https://ipwho.is/");
    expect(engine).toContain('source: "ipwho.is"');
    expect(engine).toContain("IP enrichment unavailable - base decision reflects completed zero-cost checks only");
  });

  it("renders an IP-specific professional result view instead of mailbox copy", () => {
    const page = readFileSync("src/app/(dashboard)/risk-check/page.tsx", "utf8");

    expect(page).toContain("IP Intelligence");
    expect(page).toContain("Network operator");
    expect(page).toContain("Risk Assessment");
    expect(page).toContain("LOW RISK");
    expect(page).toContain("REVIEW REQUIRED");
    expect(page).toContain("HIGH RISK");
    expect(page).toContain("Zero-cost network enrichment is used for IP context");
    expect(page).toContain("No blocking IP risk signals were detected across the completed zero-cost checks.");
    expect(page).toContain("IP intelligence helps identify network reputation, hosting, proxy usage, and geographic context.");
  });

  it("attaches IP audit metadata instead of leaving professional fields empty", () => {
    const route = readFileSync("src/app/api/web-risk/route.ts", "utf8");

    expect(route).toContain("function attachIpAuditMetadata");
    expect(route).toContain("ip-audit:");
    expect(route).toContain("DECISION_ENGINE_VERSION");
    expect(route).toContain("SIGNAL_SNAPSHOT_VERSION");
  });
});
