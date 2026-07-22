import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const apply = process.argv.includes("--apply");
const applyPreviewDatabase = process.argv.includes("--apply-preview-db");
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
const records = [
  ...seed.telegram_message_slots.map((item) => ({ key:item.slot,type:"telegram_slot",body:item })),
  ...seed.approved_scripts.map((item) => ({ key:`script:${item.slug}`,type:"approved_script",body:item })),
  ...seed.telegram_templates.map((item) => ({ key:`telegram:${item.slug}`,type:"telegram_template",body:item })),
  ...seed.faq_seed.map((item,index) => ({ key:`faq:${index+1}`,type:"faq",body:item })),
];

console.log(JSON.stringify({ mode:applyPreviewDatabase?"apply-preview-db":apply?"apply":"dry-run", program:"secwyn-india", records:records.length, telegramSlots:currentTelegramMessages.length },null,2));
if (!apply && !applyPreviewDatabase) process.exit(0);

if (applyPreviewDatabase) {
  const text=await readFile(".env.local","utf8");
  const line=text.split(/\r?\n/).find((item)=>item.startsWith("SECWYN_AFFILIATE_PREVIEW_DB_URL="));
  if(!line) throw new Error("SECWYN_AFFILIATE_PREVIEW_DB_URL is required.");
  const connectionString=line.slice(line.indexOf("=")+1);
  const target=new URL(connectionString);
  if(!target.hostname.endsWith("pooler.supabase.com")||target.port!=="5432"||target.pathname!=="/postgres") throw new Error("Preview database guard failed.");
  const database=new pg.Client({connectionString,ssl:{rejectUnauthorized:false}});
  await database.connect();
  try {
    await database.query("begin");
    const channelResult=await database.query("insert into public.affiliate_telegram_channels(program_id,channel_code,public_handle,paused,verified,message_limit_daily) values('secwyn-india','india-updates','@SecwynIndiaAffiliate',true,false,1) on conflict(program_id,channel_code) do update set paused=true returning id");
    const channelId=channelResult.rows[0].id;
    const versionIds=new Map();
    for(const record of records){
      const itemResult=await database.query("insert into public.affiliate_content_items(program_id,content_key,content_type,locale) values('secwyn-india',$1,$2,'en') on conflict(program_id,content_key,locale) do update set content_type=excluded.content_type returning id",[record.key,record.type]);
      const serialized=JSON.stringify(record.body);const checksum=createHash("sha256").update(serialized).digest("hex");
      const versionResult=await database.query("insert into public.affiliate_content_versions(content_id,version,status,body,checksum,published_at) values($1,1,'published',$2,$3,now()) on conflict(content_id,version) do nothing returning id",[itemResult.rows[0].id,record.body,checksum]);
      const versionId=versionResult.rows[0]?.id||(await database.query("select id from public.affiliate_content_versions where content_id=$1 and version=1",[itemResult.rows[0].id])).rows[0].id;
      versionIds.set(record.key,versionId);
    }
    for(let index=0;index<currentTelegramMessages.length;index+=1){
      const message=currentTelegramMessages[index];
      await database.query("insert into public.affiliate_telegram_message_slots(channel_id,slot,content_version_id,pinned,published,external_message_ref,external_message_url,replacement_required,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(channel_id,slot) do nothing",[channelId,index+1,versionIds.get(message.key)||null,message.pinned,message.published,message.messageId,message.url,message.replacementRequired===true,message.replacementRequired?"update_required":"synchronized"]);
    }
    await database.query("commit");
  } catch(error) { await database.query("rollback"); throw error; }
  finally { await database.end(); }
  console.log(JSON.stringify({ok:true,insertedOrPresent:records.length,telegramSlots:currentTelegramMessages.length}));
  process.exit(0);
}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key) throw new Error("Preview Supabase configuration is required; do not paste credentials into the command.");
if(process.env.AFFILIATE_CONTENT_SEED_TARGET!=="preview") throw new Error("AFFILIATE_CONTENT_SEED_TARGET must be preview.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let {data:channel,error:channelError}=await client.from("affiliate_telegram_channels").select("id").eq("program_id","secwyn-india").eq("channel_code","india-updates").maybeSingle();
if(channelError) throw channelError;
if(!channel){const created=await client.from("affiliate_telegram_channels").insert({program_id:"secwyn-india",channel_code:"india-updates",public_handle:"@SecwynIndiaAffiliate",paused:true,verified:false,message_limit_daily:1}).select("id").single();if(created.error) throw created.error;channel=created.data;}
const versionIds=new Map();
for(const record of records){
  const {data:item,error:itemError}=await client.from("affiliate_content_items").upsert({program_id:"secwyn-india",content_key:record.key,content_type:record.type,locale:"en"},{onConflict:"program_id,content_key,locale"}).select("id").single();
  if(itemError) throw itemError;
  const serialized=JSON.stringify(record.body);
  const checksum=createHash("sha256").update(serialized).digest("hex");
  const {data:version,error}=await client.from("affiliate_content_versions").upsert({content_id:item.id,version:1,status:"published",body:record.body,checksum,published_at:new Date().toISOString()},{onConflict:"content_id,version",ignoreDuplicates:true}).select("id").maybeSingle();
  if(error && error.code!=="23505") throw error;
  let versionId=version?.id;if(!versionId){const {data:existing,error:existingError}=await client.from("affiliate_content_versions").select("id").eq("content_id",item.id).eq("version",1).single();if(existingError) throw existingError;versionId=existing.id;}
  versionIds.set(record.key,versionId);
}
for(let index=0;index<currentTelegramMessages.length;index+=1){const message=currentTelegramMessages[index];const {error:slotError}=await client.from("affiliate_telegram_message_slots").upsert({channel_id:channel.id,slot:index+1,content_version_id:versionIds.get(message.key)||null,pinned:message.pinned,published:message.published,external_message_ref:message.messageId,external_message_url:message.url,replacement_required:message.replacementRequired===true,status:message.replacementRequired?"update_required":"synchronized"},{onConflict:"channel_id,slot",ignoreDuplicates:true});if(slotError) throw slotError;}
console.log(JSON.stringify({ok:true,insertedOrPresent:records.length,telegramSlots:currentTelegramMessages.length}));
