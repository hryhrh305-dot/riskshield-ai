import re

path = r"D:\ai-saas-mvp\src\app\api\v1\risk\check\route.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add blacklist imports
old1 = 'import { createResponse } from "@/lib/response";'
new1 = 'import { createResponse } from "@/lib/response";\nimport { checkBlacklist, autoBlacklistIfHighRisk } from "@/lib/blacklist";'
content = content.replace(old1, new1)

# 2. Add email blacklist check before email analysis
old2 = '  // Email checks\n  if (email) {'
new2 = '''  // Blacklist check - email
  const emailBlacklisted = email ? await checkBlacklist("email", email) : null;
  if (emailBlacklisted) {
    riskScore = Math.max(riskScore, Number(emailBlacklisted.risk_score) || 80);
    reasons.push("Email found in blacklist: " + (emailBlacklisted.reason || "known risk"));
    emailDetails.blacklisted = true;
    emailDetails.blacklistReason = emailBlacklisted.reason;
  }

  // Email checks
  if (email) {'''
content = content.replace(old2, new2)

# 3. Add IP blacklist check before IP analysis
old3 = '  // IP checks\n  if (ipInput) {'
new3 = '''  // Blacklist check - IP
  const ipBlacklisted = ipInput ? await checkBlacklist("ip", ipInput) : null;
  if (ipBlacklisted) {
    riskScore = Math.max(riskScore, Number(ipBlacklisted.risk_score) || 80);
    reasons.push("IP found in blacklist: " + (ipBlacklisted.reason || "known risk"));
    ipDetails.blacklisted = true;
    ipDetails.blacklistReason = ipBlacklisted.reason;
  }

  // IP checks
  if (ipInput) {'''
content = content.replace(old3, new3)

# 4. Add auto-blacklist after risk score finalization
old4 = '  riskScore = Math.min(riskScore, 100);'
new4 = '''  riskScore = Math.min(riskScore, 100);

  // Auto-blacklist high-risk signals
  if (email && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "email", value: email, risk_score: riskScore, reasons }).catch(() => {});
    if (email.split("@")[1]) autoBlacklistIfHighRisk({ type: "domain", value: email.split("@")[1].toLowerCase(), risk_score: riskScore, reasons }).catch(() => {});
  }
  if (ipInput && riskScore >= 85) {
    autoBlacklistIfHighRisk({ type: "ip", value: ipInput, risk_score: riskScore, reasons }).catch(() => {});
  }'''
content = content.replace(old4, new4)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("DONE - blacklist integrated into risk/check")
