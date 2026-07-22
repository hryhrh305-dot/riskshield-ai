import { assertTelegramPublicationAllowed, telegramIdempotencyKey, type TelegramPublication } from "./policy";
import type { AffiliateTelegramPort } from "../ports/telegram";
import { TelegramUnknownDeliveryError } from "../ports/telegram";

export type TelegramQueueItem = Readonly<{
  publication: TelegramPublication;
  renderedBody: string;
  attempts: number;
}>;

export async function dispatchTelegram(item: TelegramQueueItem, adapter: AffiliateTelegramPort) {
  assertTelegramPublicationAllowed(item.publication);
  if (item.attempts >= 5) return Object.freeze({ status:"dead_letter" as const, idempotencyKey:telegramIdempotencyKey(item.publication) });
  try {
    const result=await adapter.publish(item.publication,item.renderedBody);
    return Object.freeze({ status:"sent" as const, idempotencyKey:telegramIdempotencyKey(item.publication), externalMessageRef:result.externalMessageRef });
  } catch(error) {
    if(error instanceof TelegramUnknownDeliveryError) return Object.freeze({status:"unknown_delivery" as const,idempotencyKey:telegramIdempotencyKey(item.publication),error:error.message});
    const attempts=item.attempts+1;
    return Object.freeze({ status:attempts>=5?"dead_letter" as const:"retry" as const, attempts, retryAfterSeconds:Math.min(3600,30*2**attempts), error:error instanceof Error?error.message:"TELEGRAM_SEND_FAILED", idempotencyKey:telegramIdempotencyKey(item.publication) });
  }
}

export function indiaDailyPublicationWindow(instant:string) {
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(instant));
  const hour=Number(parts.find((part)=>part.type==="hour")?.value);
  const minute=Number(parts.find((part)=>part.type==="minute")?.value);
  return hour===12&&minute>=30&&minute<35;
}
