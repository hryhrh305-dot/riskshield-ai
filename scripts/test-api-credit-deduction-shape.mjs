import fs from "node:fs";

const checks = [
  {
    file: "src/app/api/v1/email/check/route.ts",
    expectedCredits: "requiredCredits: 1",
  },
  {
    file: "src/app/api/v1/ip/check/route.ts",
    expectedCredits: "requiredCredits: 1",
  },
  {
    file: "src/app/api/v1/risk/check/route.ts",
    expectedCredits: "requiredCredits: 1",
  },
  {
    file: "src/app/api/v1/pre-send/check/route.ts",
    expectedCredits: "requiredCredits: billableEmails.length",
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const { file, expectedCredits } of checks) {
  const source = fs.readFileSync(file, "utf8");
  const consumeIndex = source.indexOf("const legacyCreditResult = await consumeLegacyCredits");
  const riskIndex = Math.max(
    source.indexOf("const riskResult = await calculateRiskScore"),
    source.indexOf("for (const rawEmail of emails)"),
  );
  const responseIndex = source.lastIndexOf("return NextResponse.json");

  assert(source.includes('from "@/lib/legacy-credits"'), `${file}: missing legacy credit import`);
  assert(consumeIndex !== -1, `${file}: missing legacy credit deduction`);
  assert(source.includes(expectedCredits), `${file}: unexpected required credit count`);
  assert(source.includes("legacyCreditResult.creditsRemaining"), `${file}: response must expose post-deduction credits remaining`);
  assert(riskIndex === -1 || consumeIndex < riskIndex, `${file}: credit deduction must happen before full checks`);
  assert(responseIndex === -1 || consumeIndex < responseIndex, `${file}: credit deduction must happen before response`);
}

const feedbackSource = fs.readFileSync("src/app/api/feedback/route.ts", "utf8");
assert(feedbackSource.includes("createServiceClient"), "feedback route should use service client for quota/write consistency");
assert(feedbackSource.includes("feedbackId"), "feedback route should return feedbackId for traceability");

const adminFeedbackSource = fs.readFileSync("src/app/(dashboard)/admin/feedback/page.tsx", "utf8");
assert(adminFeedbackSource.includes('dynamic = "force-dynamic"'), "admin feedback page must force dynamic reads");
assert(adminFeedbackSource.includes("revalidate = 0"), "admin feedback page must disable stale revalidation");

const supabaseServerSource = fs.readFileSync("src/lib/supabase-server.ts", "utf8");
assert(supabaseServerSource.includes("createClient as createSupabaseClient"), "service client should use supabase-js admin client");
assert(supabaseServerSource.includes("persistSession: false"), "service client should not persist a user session");
assert(supabaseServerSource.includes("detectSessionInUrl: false"), "service client should not bind to browser session state");

console.log("api credit deduction and feedback shape checks passed");
