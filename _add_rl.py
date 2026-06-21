path = r"D:\ai-saas-mvp\src\app\api\v1\risk\check\route.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add risk_logs insert before the existing check/usage inserts
old_insert = """  const today = new Date().toISOString().split("T")[0];
  await Promise.all([
    supabaseAdmin.from("checks").insert({"""

new_insert = """  const today = new Date().toISOString().split("T")[0];
  await Promise.all([
    supabaseAdmin.from("risk_logs").insert({
      user_id: userId,
      api_key_id: apiKeyId,
      ip: ip || null,
      email: email || null,
      risk_score: riskScore,
      decision: result.result.decision,
      source: "risk-engine",
      ipqs_response: ipDetails?.country ? ipDetails : null,
    }),
    supabaseAdmin.from("checks").insert({"""

content = content.replace(old_insert, new_insert)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("risk_logs integrated")
