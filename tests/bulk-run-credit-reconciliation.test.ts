import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("credit cycle reconciliation", () => {
  afterEach(()=>vi.resetModules());
  it("protects the cron route with CRON_SECRET", async()=>{
    process.env.CRON_SECRET="secret";
    vi.doMock("@/lib/credit-reconciliation",()=>({reconcileDueCreditCycles:vi.fn().mockResolvedValue({processed:0})}));
    const {GET}=await import("@/app/api/cron/credit-refresh/route");
    expect((await GET(new Request("http://localhost/api/cron/credit-refresh"))).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/cron/credit-refresh",{headers:{authorization:"Bearer secret"}}))).status).toBe(200);
  });
  it("configures one daily production cron and both paid/free reconciliation",()=>{
    const config=JSON.parse(readFileSync("vercel.json","utf8"));
    expect(config.crons).toEqual([{path:"/api/cron/credit-refresh",schedule:"15 0 * * *"}]);
    const source=readFileSync("src/lib/credit-reconciliation.ts","utf8");
    expect(source).toContain("grantSubscriptionCycle");
    expect(source).toContain("grantFreeCycle");
    expect(source).toContain("paid_through");
    expect(source).toContain('.order("updated_at",{ascending:true})');
    expect(source).toContain("if(failed) throw");
  });
});
