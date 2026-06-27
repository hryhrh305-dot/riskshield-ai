import fs from "fs";
import path from "path";

const root = process.cwd();
const serverPath = path.join(root, "src/lib/credits-ledger-server.ts");
const sqlPath = path.join(root, "supabase-credits-ledger.sql");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const server = read(serverPath);
const sql = read(sqlPath);

for (const needle of [
  "getUserCreditSummaryFromLedger",
  "consumeLedgerCredits",
  "grantLedgerCredits",
  "expireOldLedgerCredits",
  "consume_ledger_credits",
]) {
  assert(server.includes(needle), `Missing server utility export or reference: ${needle}`);
}

assert(!server.includes("from(\"bulk-check\""), "Server utility must not touch runtime routes");
assert(!server.includes("from(\"usage_ledger\""), "Server utility must not use old usage_ledger");
assert(!server.includes("process.env.CREEM"), "Server utility must not touch payment envs");

for (const needle of [
  "create or replace function public.consume_ledger_credits",
  "for update skip locked",
  "credit_usage",
  "remaining_amount",
  "expires_at",
  "Not enough audit capacity",
  "No client-ready report credits remaining",
]) {
  assert(sql.includes(needle), `Missing SQL RPC shape detail: ${needle}`);
}

console.log("Credits ledger server shape check passed.");
