import re
path = r"D:\ai-saas-mvp\src\app\api\v1\risk\check\route.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
old = 'import { validateApiKey, getMonthlyLimit, getDailyLimit, getMaxTokens } from "@/lib/api-auth";'
new = 'import { validateApiKey, getMonthlyLimit, getDailyLimit, getMaxTokens } from "@/lib/api-auth";\nimport { checkIPRateLimit } from "@/lib/ip-guard";\nimport { createResponse } from "@/lib/response";'
content = content.replace(old, new)

# 2. Add client IP
old2 = 'const authHeader = req.headers.get("authorization");'
new2 = 'const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";\n\n  ' + old2
content = content.replace(old2, new2)

# 3. The daily limit block replacement
old3 = '  if ((todayUsed || 0) >= dailyLimit) {\n    return NextResponse.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });\n  }'
new3 = '  if ((todayUsed || 0) >= dailyLimit) {\n    return NextResponse.json({ success: false, error: "Daily limit reached. Try again tomorrow." }, { status: 429 });\n  }\n\n  const ipGuard = await checkIPRateLimit(clientIP, userId, apiKeyId, plan, "risk/check");\n  if (!ipGuard.allowed) {\n    return NextResponse.json({ success: false, error: "IP_RATE_LIMIT_EXCEEDED", retry_after_seconds: 60 }, { status: 429 });\n  }'
if old3 in content:
    content = content.replace(old3, new3)
    print("Step 3 OK")
else:
    print("Step 3 FAILED - pattern not found")
    # Try to find what's there
    idx = content.find('if ((todayUsed')
    if idx > 0:
        print(content[idx:idx+200])

# 4. Replace result
old4_marker = 'riskScore = Math.min(riskScore, 100);'
old4_end_marker = 'const today = new Date().toISOString().split("T")[0];'
idx_start = content.find(old4_marker)
idx_end = content.find(old4_end_marker, idx_start)
print(f"Index range: {idx_start} to {idx_end}")

if idx_start > 0 and idx_end > 0:
    new4 = '''riskScore = Math.min(riskScore, 100);

  let aiReason = "";
  try {
    const summary = "Email: " + (email || "N/A") + ", IP: " + (ip || "N/A") + ", Score: " + riskScore + ", Reasons: " + (reasons.join(", ") || "none");
    const completion = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: "You are a fraud detection AI. Explain in one short Chinese sentence why this request was flagged." }, { role: "user", content: summary }],
      max_tokens: 80, temperature: 0.3,
    });
    aiReason = completion.choices[0]?.message?.content?.trim() || "";
  } catch { /* AI optional */ }

  const result = createResponse({
    score: riskScore, reasons,
    email: email || null, ip: ip || null,
    emailDetails, ipDetails,
    aiReason: aiReason || undefined,
    ipRemaining: ipGuard.limit - ipGuard.ipRequestCount,
    dailyRemaining: dailyLimit - (todayUsed || 0),
    monthlyRemaining: monthlyLimit - (monthlyUsed || 0),
  });

  '''
    content = content[:idx_start] + new4 + content[idx_end:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("DONE")
