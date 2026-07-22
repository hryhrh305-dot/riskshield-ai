import { describe,expect,it } from "vitest";
import { dispatchTelegram, indiaDailyPublicationWindow, MockAffiliateTelegramAdapter, TelegramUnknownDeliveryError } from "@/modules/affiliate";

describe("affiliate Telegram dispatcher",()=>{
  it("dispatches approved content once through a port",async()=>{
    const adapter=new MockAffiliateTelegramAdapter();
    const publication={id:"content-1",kind:"daily_content" as const,consent:false,contentStatus:"approved" as const};
    const result=await dispatchTelegram({publication,renderedBody:"Approved",attempts:0},adapter);
    expect(result.status).toBe("sent"); expect(adapter.sent).toHaveLength(1);
  });
  it("moves the fifth failure to dead letter",async()=>{
    const adapter={publish:async()=>{throw new Error("mock failure")}};
    const publication={id:"content-2",kind:"daily_content" as const,consent:false,contentStatus:"approved" as const};
    expect((await dispatchTelegram({publication,renderedBody:"Approved",attempts:4},adapter)).status).toBe("dead_letter");
  });
  it("uses the 12:30 India daily window",()=>{
    expect(indiaDailyPublicationWindow("2026-07-22T07:00:00.000Z")).toBe(true);
    expect(indiaDailyPublicationWindow("2026-07-22T06:59:00.000Z")).toBe(false);
  });
  it("does not blindly retry an unknown provider delivery",async()=>{
    const adapter={publish:async()=>{throw new TelegramUnknownDeliveryError()}};const publication={id:"unknown",kind:"daily_content" as const,consent:false,contentStatus:"approved" as const};
    expect((await dispatchTelegram({publication,renderedBody:"Approved",attempts:0},adapter)).status).toBe("unknown_delivery");
  });
});
