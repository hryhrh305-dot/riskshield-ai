import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const seed = JSON.parse(await readFile(new URL("../docs/affiliate/handoff-v1.0.0/machine/28_CONTENT_SEED.json", import.meta.url), "utf8"));
const currentTelegramMessages = [
  { key:"TG_SECWYN_INDIA_WELCOME", messageId:"3", url:"https://t.me/SecwynIndiaAffiliate/3", published:true, pinned:true },
  { key:"TG_SECWYN_INDIA_ANTI_SCAM", messageId:"5", url:"https://t.me/SecwynIndiaAffiliate/5", published:true, pinned:true },
  { key:"TG_SECWYN_INDIA_COMMISSIONS", messageId:"7", url:"https://t.me/SecwynIndiaAffiliate/7", published:true, pinned:false },
  { key:"TG_SECWYN_INDIA_ACTIVATION", messageId:"8", url:"https://t.me/SecwynIndiaAffiliate/8", published:true, pinned:false },
  { key:"TG_SECWYN_INDIA_CHANNEL_RULES", messageId:"9", url:"https://t.me/SecwynIndiaAffiliate/9", published:true, pinned:false },
  { key:"TG_SECWYN_INDIA_ATTRIBUTION", messageId:"10", url:"https://t.me/SecwynIndiaAffiliate/10", published:true, pinned:false },
  {
    key:"TG_SECWYN_INDIA_APPLICATION_PENDING",
    messageId:"11",
    url:"https://t.me/SecwynIndiaAffiliate/11",
    published:true,
    pinned:false,
    replacementRequired:true,
    body:"Affiliate applications are not yet available. An official application link will be published in this channel when the application page is ready. Do not submit personal, payment, banking, or identity information through Telegram.",
  },
];
const seedSlots = new Map(seed.telegram_message_slots.map((item) => [item.slot,item]));
const records = [
  ...currentTelegramMessages.map((message,index) => {
    const original=seedSlots.get(message.key) || {};
    return {
      key:message.key,
      type:"telegram_slot",
      body:{...original,slot:message.key,status:"published",pinned:message.pinned,telegram_message_id:message.messageId,telegram_message_url:message.url,replacement_required:message.replacementRequired===true,body:message.body||original.body},
      slotNumber:index+1,
      pinned:message.pinned,
      published:message.published,
      messageId:message.messageId,
      messageUrl:message.url,
      replacementRequired:message.replacementRequired===true,
    };
  }),
  ...seed.approved_scripts.map((item) => ({ key:`script:${item.slug}`,type:"approved_script",body:item })),
  ...seed.telegram_templates.map((item) => ({ key:`telegram:${item.slug}`,type:"telegram_template",body:item })),
  ...seed.faq_seed.map((item,index) => ({ key:`faq:${index+1}`,type:"faq",body:item })),
];

console.log(JSON.stringify({ mode:apply?"apply":"dry-run", program:"secwyn-india", records:records.length, telegramSlots:currentTelegramMessages.length },null,2));
if (!apply) process.exit(0);

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key) throw new Error("Preview Supabase configuration is required; do not paste credentials into the command.");
if(process.env.AFFILIATE_CONTENT_SEED_TARGET!=="preview") throw new Error("AFFILIATE_CONTENT_SEED_TARGET must be preview.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let {data:channel,error:channelError}=await client.from("affiliate_telegram_channels").select("id").eq("program_id","secwyn-india").eq("channel_code","india-updates").maybeSingle();
if(channelError) throw channelError;
if(!channel){const created=await client.from("affiliate_telegram_channels").insert({program_id:"secwyn-india",channel_code:"india-updates",public_handle:"@SecwynIndiaAffiliate",paused:true,verified:false,message_limit_daily:1}).select("id").single();if(created.error) throw created.error;channel=created.data;}
for(const record of records){
  const {data:item,error:itemError}=await client.from("affiliate_content_items").upsert({program_id:"secwyn-india",content_key:record.key,content_type:record.type,locale:"en"},{onConflict:"program_id,content_key,locale"}).select("id").single();
  if(itemError) throw itemError;
  const serialized=JSON.stringify(record.body);
  const checksum=createHash("sha256").update(serialized).digest("hex");
  const {data:version,error}=await client.from("affiliate_content_versions").upsert({content_id:item.id,version:1,status:"published",body:record.body,checksum,published_at:new Date().toISOString()},{onConflict:"content_id,version",ignoreDuplicates:true}).select("id").maybeSingle();
  if(error && error.code!=="23505") throw error;
  let versionId=version?.id;if(!versionId){const {data:existing,error:existingError}=await client.from("affiliate_content_versions").select("id").eq("content_id",item.id).eq("version",1).single();if(existingError) throw existingError;versionId=existing.id;}
  if(record.type==="telegram_slot"){const {error:slotError}=await client.from("affiliate_telegram_message_slots").upsert({channel_id:channel.id,slot:record.slotNumber,content_version_id:versionId,pinned:record.pinned,published:record.published,external_message_ref:record.messageId,external_message_url:record.messageUrl,replacement_required:record.replacementRequired,status:record.replacementRequired?"update_required":"synchronized"},{onConflict:"channel_id,slot",ignoreDuplicates:true});if(slotError) throw slotError;}
}
console.log(JSON.stringify({ok:true,insertedOrPresent:records.length}));
