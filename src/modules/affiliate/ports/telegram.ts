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
  constructor(private readonly token:string,private readonly chatId:string,private readonly fetcher:typeof fetch=fetch){if(!token||!chatId) throw new Error("AFFILIATE_TELEGRAM_NOT_CONFIGURED");}
  async assertPrivateCanaryTarget(){
    const response=await this.fetcher(`https://api.telegram.org/bot${this.token}/getChat`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:this.chatId}),signal:AbortSignal.timeout(10000)});
    const payload=await response.json() as {ok?:boolean;result?:{title?:string;username?:string;type?:string}};
    if(!response.ok||!payload.ok||!payload.result) throw new Error("AFFILIATE_TELEGRAM_TARGET_UNVERIFIED");
    if(payload.result.username?.toLowerCase()==="secwynindiaaffiliate"||payload.result.title==="Secwyn India Affiliate Updates") throw new Error("AFFILIATE_TELEGRAM_REAL_CHANNEL_DENIED");
    if(payload.result.title!=="Secwyn Affiliate Bot Test") throw new Error("AFFILIATE_TELEGRAM_PRIVATE_TARGET_REQUIRED");
    return {title:payload.result.title,type:payload.result.type||"unknown"};
  }
  async publish(publication:TelegramPublication,renderedBody:string){
    let response:Response;try{response=await this.fetcher(`https://api.telegram.org/bot${this.token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:this.chatId,text:renderedBody,disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});}catch{throw new TelegramUnknownDeliveryError();}
    const payload=await response.json() as {ok?:boolean;result?:{message_id?:number};description?:string};
    if(!response.ok||!payload.ok||!payload.result?.message_id) throw new Error(`AFFILIATE_TELEGRAM_PROVIDER_${response.status}`);
    return {externalMessageRef:String(payload.result.message_id)};
  }
}
