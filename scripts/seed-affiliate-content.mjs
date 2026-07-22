import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const seed = JSON.parse(await readFile(new URL("../docs/affiliate/handoff-v1.0.0/machine/28_CONTENT_SEED.json", import.meta.url), "utf8"));
const records = [
  ...seed.telegram_message_slots.map((item,index) => ({ key:item.slot,type:"telegram_slot",body:item,slotNumber:index+1,pinned:item.pinned })),
  ...seed.approved_scripts.map((item) => ({ key:`script:${item.slug}`,type:"approved_script",body:item })),
  ...seed.telegram_templates.map((item) => ({ key:`telegram:${item.slug}`,type:"telegram_template",body:item })),
  ...seed.faq_seed.map((item,index) => ({ key:`faq:${index+1}`,type:"faq",body:item })),
];

console.log(JSON.stringify({ mode:apply?"apply":"dry-run", program:"secwyn-india", records:records.length, telegramSlots:seed.telegram_message_slots.length },null,2));
if (!apply) process.exit(0);

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key) throw new Error("Preview Supabase configuration is required; do not paste credentials into the command.");
if(process.env.AFFILIATE_CONTENT_SEED_TARGET!=="preview") throw new Error("AFFILIATE_CONTENT_SEED_TARGET must be preview.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:channel,error:channelError}=await client.from("affiliate_telegram_channels").upsert({program_id:"secwyn-india",channel_code:"india-updates",paused:true,verified:false,message_limit_daily:1},{onConflict:"program_id,channel_code"}).select("id").single();
if(channelError) throw channelError;
for(const record of records){
  const {data:item,error:itemError}=await client.from("affiliate_content_items").upsert({program_id:"secwyn-india",content_key:record.key,content_type:record.type,locale:"en"},{onConflict:"program_id,content_key,locale"}).select("id").single();
  if(itemError) throw itemError;
  const serialized=JSON.stringify(record.body);
  const checksum=createHash("sha256").update(serialized).digest("hex");
  const {data:version,error}=await client.from("affiliate_content_versions").upsert({content_id:item.id,version:1,status:"published",body:record.body,checksum,published_at:new Date().toISOString()},{onConflict:"content_id,version",ignoreDuplicates:true}).select("id").maybeSingle();
  if(error && error.code!=="23505") throw error;
  let versionId=version?.id;if(!versionId){const {data:existing,error:existingError}=await client.from("affiliate_content_versions").select("id").eq("content_id",item.id).eq("version",1).single();if(existingError) throw existingError;versionId=existing.id;}
  if(record.type==="telegram_slot"){const {error:slotError}=await client.from("affiliate_telegram_message_slots").upsert({channel_id:channel.id,slot:record.slotNumber,content_version_id:versionId,pinned:record.pinned,status:"pending_sync"},{onConflict:"channel_id,slot"});if(slotError) throw slotError;}
}
console.log(JSON.stringify({ok:true,insertedOrPresent:records.length}));
