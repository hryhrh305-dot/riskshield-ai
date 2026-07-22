import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client, Pool } = pg;
const PREFIX = `runtime-${Date.now()}`;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf("=");
    return index > 0 ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
  }));
}

const env = parseEnv(await readFile(".env.local", "utf8"));
const connectionString = env.SECWYN_AFFILIATE_PREVIEW_DB_URL;
if (!connectionString) throw new Error("AFFILIATE_PREVIEW_DB_URL_REQUIRED");
const target = new URL(connectionString);
const production = env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL) : null;
const targetRef = target.username.split(".").at(-1) || "";
const productionRef = production?.hostname.split(".")[0] || "";
if (!target.hostname.endsWith("pooler.supabase.com") || target.port !== "5432" || target.pathname !== "/postgres" || targetRef.length < 12 || targetRef === productionRef) {
  throw new Error("AFFILIATE_PREVIEW_IDENTITY_GUARD_FAILED");
}

const ssl = { rejectUnauthorized: false };
const client = new Client({ connectionString, ssl });
await client.connect();
const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(`${name}: ${detail}`);
};

const scheduleFor = (phase, plan, interval, paidAt) => {
  const amounts = {
    launch: { starter: { monthly: 2500n, annual: 12000n }, growth: { monthly: 10000n, annual: 60000n }, scale: { monthly: 30000n, annual: 150000n } },
    evergreen: { starter: { monthly: 1500n, annual: 10000n }, growth: { monthly: 7500n, annual: 50000n }, scale: { monthly: 25000n, annual: 120000n } },
  };
  const days = interval === "monthly" ? [30] : plan === "starter" ? [30, 90] : plan === "growth" ? [30, 120, 210, 300] : [30, 60, 90, 120, 150, 180];
  const amount = amounts[phase][plan][interval];
  let allocated = 0n;
  const rows = days.map((day, index) => {
    const itemAmount = index === days.length - 1 ? amount - allocated : amount / BigInt(days.length);
    allocated += itemAmount;
    const release = new Date(paidAt);
    release.setUTCDate(release.getUTCDate() + day);
    return { releaseAt: release.toISOString(), amount: { currency: "USD", amountMinor: itemAmount.toString() } };
  });
  return { amount, rows };
};

async function metadataAcceptance() {
  const tables = (await client.query("select tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'affiliate_%' order by tablename")).rows;
  const functions = (await client.query("select p.proname,p.prosecdef,coalesce(array_to_string(p.proconfig,','),'') config,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'affiliate_%' order by p.proname")).rows;
  const definers = functions.filter((item) => item.prosecdef);
  record("affiliate_table_count", tables.length === 60, String(tables.length));
  record("affiliate_rls_all_enabled", tables.every((item) => item.rowsecurity), String(tables.filter((item) => !item.rowsecurity).length));
  record("affiliate_function_count", functions.length >= 18, String(functions.length));
  record("security_definer_search_path", definers.every((item) => item.config.includes("search_path=public")), String(definers.length));
  record("security_definer_acl", definers.every((item) => !item.acl.includes("anon") && !item.acl.includes("authenticated") && item.acl.includes("service_role")), String(definers.length));
  return { tables: tables.length, functions: functions.length, securityDefiners: definers.length };
}

async function rlsAcceptance() {
  const userA = randomUUID();
  const userB = randomUUID();
  const memberA = randomUUID();
  const memberB = randomUUID();
  await client.query("begin");
  try {
    await client.query("insert into public.affiliate_applications(id,program_id,user_id,country_code,status) values($1,'secwyn-india',$2,'IN','submitted'),($3,'secwyn-india',$4,'IN','submitted')", [randomUUID(), userA, randomUUID(), userB]);
    await client.query("insert into public.affiliate_memberships(id,program_id,user_id,affiliate_code,status) values($1,'secwyn-india',$2,$3,'approved'),($4,'secwyn-india',$5,$6,'approved')", [memberA, userA, `${PREFIX}-a`, memberB, userB, `${PREFIX}-b`]);
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userA]);
    const own = Number((await client.query("select count(*) n from public.affiliate_memberships")).rows[0].n);
    const other = Number((await client.query("select count(*) n from public.affiliate_memberships where id=$1", [memberB])).rows[0].n);
    record("rls_owner_visible", own === 1, String(own));
    record("rls_cross_affiliate_hidden", other === 0, String(other));
    let ledgerWriteDenied = false;
    try { await client.query("insert into public.affiliate_ledger_entries(program_id,affiliate_id,entry_type,currency,amount_minor,effective_at,posting_state,idempotency_key,correlation_id) values('secwyn-india',$1,'adjustment','USD',1,now(),'payable',$2,$3)", [memberA, `${PREFIX}-forbidden`, PREFIX]); } catch { ledgerWriteDenied = true; }
    record("rls_authenticated_ledger_write_denied", ledgerWriteDenied, String(ledgerWriteDenied));
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.query("begin");
  try {
    await client.query("set local role anon");
    let privateReadDenied = false;
    try { await client.query("select * from public.affiliate_memberships limit 1"); } catch { privateReadDenied = true; }
    record("rls_anon_private_read_denied", privateReadDenied, String(privateReadDenied));
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function immutableAcceptance() {
  const member = randomUUID();
  const attribution = randomUUID();
  const sale = randomUUID();
  const decision = randomUUID();
  const rule = (await client.query("select id from public.affiliate_rule_versions where program_id='secwyn-india' and version=1")).rows[0].id;
  await client.query("begin");
  try {
    await client.query("insert into public.affiliate_memberships(id,program_id,user_id,affiliate_code,status) values($1,'secwyn-india',$2,$3,'approved')", [member, randomUUID(), `${PREFIX}-immutable`]);
    await client.query("insert into public.affiliate_attributions(id,program_id,affiliate_id,canonical_customer_id,click_at,expires_at,fingerprint) values($1,'secwyn-india',$2,$3,now(),now()+interval '90 days',$4)", [attribution, member, `${PREFIX}-immutable`, `${PREFIX}-immutable`]);
    await client.query("insert into public.affiliate_sales(id,program_id,attribution_id,provider,provider_transaction_id,canonical_customer_id,plan,billing_interval,currency,gross_amount_minor,paid_at,status,raw_event_ref) values($1,'secwyn-india',$2,'creem',$3,$4,'starter','monthly','USD',19900,now(),'qualified',$5)", [sale, attribution, `${PREFIX}-tx`, `${PREFIX}-immutable`, `${PREFIX}-event`]);
    await client.query("insert into public.affiliate_commission_decisions(id,program_id,sale_id,affiliate_id,rule_version_id,currency,amount_minor,status,reason,schedule,fingerprint,calculator_version) values($1,'secwyn-india',$2,$3,$4,'USD',2500,'shadow','test','[]',$5,'runtime')", [decision, sale, member, rule, `${PREFIX}-fingerprint`]);
    await client.query("insert into public.affiliate_ledger_entries(program_id,affiliate_id,decision_id,entry_type,currency,amount_minor,effective_at,posting_state,idempotency_key,correlation_id) values('secwyn-india',$1,$2,'commission','USD',2500,now(),'shadow',$3,$4)", [member, decision, `${PREFIX}-ledger`, PREFIX]);
    await client.query("insert into public.affiliate_reconciliations(program_id,reconciliation_date,source_count,decision_count,ledger_amount_minor,payout_amount_minor,status,evidence) values('secwyn-india',current_date,1,1,2500,0,'matched','{}')");
    await client.query("insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key) values('secwyn-india','runtime',$1,'runtime.test',$2,$3)", [PREFIX, { safe: true }, `${PREFIX}-outbox`]);
    const attempts = [
      "update public.affiliate_sales set gross_amount_minor=1 where id=$1",
      "delete from public.affiliate_sales where id=$1",
      "update public.affiliate_commission_decisions set amount_minor=1 where id=$1",
      "update public.affiliate_ledger_entries set amount_minor=1 where decision_id=$1",
      "update public.affiliate_reconciliations set source_count=2 where program_id='secwyn-india' and reconciliation_date=current_date",
      "update public.affiliate_outbox_events set payload='{}' where idempotency_key=$2",
    ];
    let denied = 0;
    for (const sql of attempts) {
      await client.query("savepoint immutable_attempt");
      try { await client.query(sql, [sale, `${PREFIX}-outbox`]); } catch { denied += 1; await client.query("rollback to savepoint immutable_attempt"); }
      await client.query("release savepoint immutable_attempt");
    }
    record("immutable_mutations_denied", denied === attempts.length, `${denied}/${attempts.length}`);
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function shadowAcceptance() {
  const member = randomUUID();
  const ruleRows = (await client.query("select id,version from public.affiliate_rule_versions where program_id='secwyn-india' order by version")).rows;
  const ruleIds = new Map(ruleRows.map((row) => [Number(row.version), row.id]));
  await client.query("begin");
  try {
    await client.query("insert into public.affiliate_memberships(id,program_id,user_id,affiliate_code,status) values($1,'secwyn-india',$2,$3,'approved')", [member, randomUUID(), `${PREFIX}-shadow`]);
    let scenarios = 0;
    for (let round = 0; round < 3; round += 1) {
      for (const phase of ["launch", "evergreen"]) for (const plan of ["starter", "growth", "scale"]) for (const interval of ["monthly", "annual"]) {
        if (scenarios >= 36) break;
        const saleId = randomUUID();
        const attribution = randomUUID();
        const decision = randomUUID();
        const paidAt = phase === "launch" ? `2026-${String(8 + round).padStart(2, "0")}-01T00:00:00.000Z` : `2027-${String(8 + round).padStart(2, "0")}-01T00:00:00.000Z`;
        const calculated = scheduleFor(phase, plan, interval, paidAt);
        const fingerprint = createHash("sha256").update(`${PREFIX}|${scenarios}`).digest("hex");
        await client.query("insert into public.affiliate_attributions(id,program_id,affiliate_id,canonical_customer_id,click_at,expires_at,fingerprint) values($1,'secwyn-india',$2,$3,$4,$4::timestamptz+interval '90 days',$5)", [attribution, member, `${PREFIX}-shadow-${scenarios}`, paidAt, `${PREFIX}-shadow-${scenarios}`]);
        await client.query("select public.affiliate_record_sale_decision('shadow',$1,'secwyn-india',$2,'creem',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)", [saleId, attribution, `${PREFIX}-tx-${scenarios}`, `${PREFIX}-shadow-${scenarios}`, plan, interval, plan === "starter" ? 19900 : plan === "growth" ? 99900 : 399900, paidAt, `${PREFIX}-event-${scenarios}`, decision, member, ruleIds.get(phase === "launch" ? 1 : 2), calculated.amount, "SHADOW_RUNTIME", JSON.stringify(calculated.rows), fingerprint, "runtime-primary-v1", calculated.amount, JSON.stringify(calculated.rows), `${PREFIX}-correlation-${scenarios}`]);
        scenarios += 1;
      }
    }
    const counts = (await client.query("select count(*)::int decisions,count(*) filter(where status='shadow')::int shadows from public.affiliate_commission_decisions where calculator_version='runtime-primary-v1'")).rows[0];
    const mismatches = Number((await client.query("select count(*) n from public.affiliate_commission_audits a join public.affiliate_commission_decisions d on d.id=a.decision_id where d.calculator_version='runtime-primary-v1' and not a.matched")).rows[0].n);
    record("postgres_shadow_scenarios", scenarios === 36 && counts.decisions === 36 && counts.shadows === 36, String(scenarios));
    record("postgres_shadow_mismatch", mismatches === 0, String(mismatches));
    await client.query("rollback");
    return { scenarios, mismatches };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function concurrentAcceptance() {
  const member = randomUUID();
  const attribution = randomUUID();
  const sale = randomUUID();
  const decision = randomUUID();
  const rule = (await client.query("select id from public.affiliate_rule_versions where program_id='secwyn-india' and version=1")).rows[0].id;
  const paidAt = "2026-08-01T00:00:00.000Z";
  const calculated = scheduleFor("launch", "starter", "monthly", paidAt);
  await client.query("insert into public.affiliate_memberships(id,program_id,user_id,affiliate_code,status) values($1,'secwyn-india',$2,$3,'approved')", [member, randomUUID(), `${PREFIX}-concurrent`]);
  await client.query("insert into public.affiliate_attributions(id,program_id,affiliate_id,canonical_customer_id,click_at,expires_at,fingerprint) values($1,'secwyn-india',$2,$3,$4,$4::timestamptz+interval '90 days',$5)", [attribution, member, `${PREFIX}-concurrent-customer`, paidAt, `${PREFIX}-concurrent-fp`]);
  const pool = new Pool({ connectionString, ssl, max: 12 });
  const args = [sale, attribution, `${PREFIX}-concurrent-transaction`, `${PREFIX}-concurrent-customer`, "starter", "monthly", 19900, paidAt, `${PREFIX}-concurrent-event`, decision, member, rule, calculated.amount, "CONCURRENT_RUNTIME", JSON.stringify(calculated.rows), createHash("sha256").update(PREFIX).digest("hex"), "runtime-concurrent-v1", calculated.amount, JSON.stringify(calculated.rows), `${PREFIX}-concurrent-correlation`];
  const sql = "select public.affiliate_record_sale_decision('shadow',$1,'secwyn-india',$2,'creem',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)";
  const calls = await Promise.allSettled(Array.from({ length: 100 }, () => pool.query(sql, args)));
  const counts = (await client.query("select (select count(*) from public.affiliate_sales where id=$1)::int sales,(select count(*) from public.affiliate_commission_decisions where id=$2)::int decisions,(select count(*) from public.affiliate_ledger_entries where decision_id=$2)::int ledger,(select count(*) from public.affiliate_outbox_events where aggregate_id=$2::text)::int outbox", [sale, decision])).rows[0];
  record("concurrent_payment_100_single_decision", counts.sales === 1 && counts.decisions === 1 && counts.ledger === 1 && counts.outbox === 1, JSON.stringify({ ...counts, fulfilled: calls.filter((item) => item.status === "fulfilled").length }));
  const reversalArgs = [sale, member, decision, `${PREFIX}-refund-event`, "refund", 9950, 1250, "shadow", `${PREFIX}-refund-correlation`];
  const reversalSql = "select public.affiliate_record_reversal('secwyn-india',$1,$2,$3,$4,$5,$6,$7,$8,$9)";
  await Promise.allSettled(Array.from({ length: 100 }, () => pool.query(reversalSql, reversalArgs)));
  const reversals = Number((await client.query("select count(*) n from public.affiliate_ledger_entries where idempotency_key=$1", [`reversal:${PREFIX}-refund-event`])).rows[0].n);
  record("concurrent_refund_100_single_clawback", reversals === 1, String(reversals));

  const chargebackAttribution = randomUUID();
  const chargebackSale = randomUUID();
  const chargebackDecision = randomUUID();
  const chargebackCustomer = `${PREFIX}-chargeback-customer`;
  await client.query("insert into public.affiliate_attributions(id,program_id,affiliate_id,canonical_customer_id,click_at,expires_at,fingerprint) values($1,'secwyn-india',$2,$3,$4,$4::timestamptz+interval '90 days',$5)", [chargebackAttribution, member, chargebackCustomer, paidAt, `${PREFIX}-chargeback-fp`]);
  const chargebackSaleArgs = [chargebackSale, chargebackAttribution, `${PREFIX}-chargeback-transaction`, chargebackCustomer, "starter", "monthly", 19900, paidAt, `${PREFIX}-chargeback-source`, chargebackDecision, member, rule, calculated.amount, "CONCURRENT_CHARGEBACK_RUNTIME", JSON.stringify(calculated.rows), createHash("sha256").update(`${PREFIX}-chargeback`).digest("hex"), "runtime-concurrent-v1", calculated.amount, JSON.stringify(calculated.rows), `${PREFIX}-chargeback-correlation`];
  await pool.query(sql, chargebackSaleArgs);
  const chargebackArgs = [chargebackSale, member, chargebackDecision, `${PREFIX}-chargeback-event`, "chargeback", 19900, 2500, "shadow", `${PREFIX}-chargeback-correlation`];
  await Promise.allSettled(Array.from({ length: 100 }, () => pool.query(reversalSql, chargebackArgs)));
  const chargebacks = Number((await client.query("select count(*) n from public.affiliate_ledger_entries where idempotency_key=$1", [`reversal:${PREFIX}-chargeback-event`])).rows[0].n);
  record("concurrent_chargeback_100_single_clawback", chargebacks === 1, String(chargebacks));

  const outboxKeys = Array.from({ length: 100 }, (_, index) => `${PREFIX}-worker-outbox-${index}`);
  for (const key of outboxKeys) await client.query("insert into public.affiliate_outbox_events(program_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key) values('secwyn-india','runtime',$1,'runtime.worker','{}',$2)", [key, key]);
  const outboxClaims = await Promise.all(Array.from({ length: 100 }, (_, index) => pool.query("select id from public.affiliate_claim_outbox($1,1)", [`${PREFIX}-outbox-worker-${index}`])));
  const claimedOutbox = outboxClaims.flatMap((result) => result.rows.map((row) => row.id));
  record("concurrent_outbox_unique_claims", claimedOutbox.length === 100 && new Set(claimedOutbox).size === 100, `${claimedOutbox.length}/${new Set(claimedOutbox).size}`);

  const channel = randomUUID();
  await client.query("insert into public.affiliate_telegram_channels(id,program_id,channel_code,paused,verified) values($1,'secwyn-india',$2,true,false)", [channel, `${PREFIX}-private-test`]);
  for (let index = 0; index < 100; index += 1) await client.query("insert into public.affiliate_telegram_publications(channel_id,publication_type,subject_ref,idempotency_key) values($1,'qualified_sale',$2,$3)", [channel, `${PREFIX}-subject-${index}`, `${PREFIX}-telegram-${index}`]);
  const telegramClaims = await Promise.all(Array.from({ length: 100 }, (_, index) => pool.query("select id from public.affiliate_claim_telegram_publications($1,array['qualified_sale'],1)", [`${PREFIX}-telegram-worker-${index}`])));
  const claimedTelegram = telegramClaims.flatMap((result) => result.rows.map((row) => row.id));
  record("concurrent_telegram_unique_claims", claimedTelegram.length === 100 && new Set(claimedTelegram).size === 100, `${claimedTelegram.length}/${new Set(claimedTelegram).size}`);

  const dailyAttempts = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => pool.query("insert into public.affiliate_telegram_publications(channel_id,publication_type,local_publication_date,idempotency_key) values($1,'daily_content',current_date,$2)", [channel, `${PREFIX}-daily-${index}`])));
  const dailyCount = Number((await client.query("select count(*) n from public.affiliate_telegram_publications where channel_id=$1 and publication_type='daily_content' and local_publication_date=current_date", [channel])).rows[0].n);
  record("concurrent_daily_content_unique", dailyCount === 1 && dailyAttempts.filter((item) => item.status === "fulfilled").length === 1, String(dailyCount));

  const content = randomUUID();
  const contentVersion = randomUUID();
  await client.query("insert into public.affiliate_content_items(id,program_id,content_key,content_type) values($1,'secwyn-india',$2,'runtime')", [content, `${PREFIX}-content`]);
  await client.query("insert into public.affiliate_content_versions(id,content_id,version,status,body,checksum) values($1,$2,1,'approved',$3,$4)", [contentVersion, content, { title: "Synthetic runtime content" }, createHash("sha256").update(PREFIX).digest("hex")]);
  const contentPublishes = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => pool.query("select public.affiliate_publish_content($1,$2,$3)", [contentVersion, randomUUID(), `${PREFIX}-publish-${index}`])));
  const contentPublicationCount = Number((await client.query("select count(*) n from public.affiliate_content_publications where content_version_id=$1", [contentVersion])).rows[0].n);
  record("concurrent_content_publish_unique", contentPublicationCount === 1 && contentPublishes.filter((item) => item.status === "fulfilled").length === 1, `${contentPublicationCount}/${contentPublishes.filter((item) => item.status === "fulfilled").length}`);

  const rulePublishes = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => pool.query("select public.affiliate_publish_rule_schedule('secwyn-india',$1,$2,$3)", ["2026-07-22T07:00:00.000Z", randomUUID(), `${PREFIX}-rule-${index}`])));
  const publishedRules = Number((await client.query("select count(*) n from public.affiliate_rule_versions where program_id='secwyn-india' and status='published'")).rows[0].n);
  record("concurrent_rule_publish_idempotent", publishedRules === 2 && rulePublishes.every((item) => item.status === "fulfilled"), `${publishedRules}/${rulePublishes.filter((item) => item.status === "fulfilled").length}`);
  await pool.end();
  return { paymentCalls: 100, refundCalls: 100, chargebackCalls: 100, outboxWorkers: 100, telegramWorkers: 100, requiresReset: true };
}

try {
  const metadata = await metadataAcceptance();
  await rlsAcceptance();
  await immutableAcceptance();
  const shadow = await shadowAcceptance();
  const concurrency = await concurrentAcceptance();
  console.log(JSON.stringify({ ok: true, metadata, shadow, concurrency, checks }, null, 2));
} finally {
  await client.end();
}
