import type { TelegramPublication } from "../telegram/policy";

export interface AffiliateTelegramPort {
  publish(publication: TelegramPublication, renderedBody: string): Promise<{ externalMessageRef: string }>;
}
export class TelegramUnknownDeliveryError extends Error { constructor(){super("AFFILIATE_TELEGRAM_UNKNOWN_DELIVERY");this.name="TelegramUnknownDeliveryError";} }

export class MockAffiliateTelegramAdapter implements AffiliateTelegramPort {
  readonly sent: ReadonlyArray<{ publication: TelegramPublication; renderedBody: string }> = [];
  async publish(publication: TelegramPublication, renderedBody: string) {
    (this.sent as Array<{ publication: TelegramPublication; renderedBody: string }>).push({ publication, renderedBody });
    return { externalMessageRef: `mock:${publication.id}` };
  }
}

export class TelegramBotAdapter implements AffiliateTelegramPort {
  constructor(private readonly token:string,private readonly chatId:string){if(!token||!chatId) throw new Error("AFFILIATE_TELEGRAM_NOT_CONFIGURED");}
  async publish(publication:TelegramPublication,renderedBody:string){
    let response:Response;try{response=await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:this.chatId,text:renderedBody,disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});}catch{throw new TelegramUnknownDeliveryError();}
    const payload=await response.json() as {ok?:boolean;result?:{message_id?:number};description?:string};
    if(!response.ok||!payload.ok||!payload.result?.message_id) throw new Error(`AFFILIATE_TELEGRAM_PROVIDER_${response.status}`);
    return {externalMessageRef:String(payload.result.message_id)};
  }
}
