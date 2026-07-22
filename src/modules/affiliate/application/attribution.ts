import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function key() { const value=process.env.AFFILIATE_ATTRIBUTION_HMAC_KEY; if(!value||value.length<32) throw new Error("AFFILIATE_ATTRIBUTION_NOT_CONFIGURED"); return value; }
export function signAffiliateClick(payload:{code:string;clickedAt:string;source?:string;channelCode?:string}) {
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature=createHmac("sha256",key()).update(body).digest("base64url");
  return `${body}.${signature}`;
}
export function verifyAffiliateClick(token:string){
  const [body,signature]=token.split("."); if(!body||!signature) throw new Error("AFFILIATE_ATTRIBUTION_INVALID");
  const expected=createHmac("sha256",key()).update(body).digest(); const received=Buffer.from(signature,"base64url");
  if(received.length!==expected.length||!timingSafeEqual(received,expected)) throw new Error("AFFILIATE_ATTRIBUTION_INVALID");
  const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as {code?:string;clickedAt?:string;source?:string;channelCode?:string};
  if(!payload.code||!payload.clickedAt||Date.now()-Date.parse(payload.clickedAt)>30*86400000) throw new Error("AFFILIATE_ATTRIBUTION_EXPIRED");
  return {code:payload.code,clickedAt:payload.clickedAt,source:payload.source,channelCode:payload.channelCode};
}
export function canonicalAffiliateCustomerId(userId:string){return createHmac("sha256",key()).update(`customer:${userId}`).digest("hex");}

