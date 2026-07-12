import { calculateRiskScore } from "@/lib/risk-engine";

export async function processBulkRunChunk(contacts: string[]) {
  const results = await Promise.all(contacts.map(async (email) => {
    const risk = await calculateRiskScore({ email, shouldCheckMX: true });
    return {
      email,
      risk_score: risk.score,
      risk_level: risk.decision,
      reasons: risk.reasons,
      details: risk.emailDetails,
      risk_factors: risk.risk_factors,
      recommendation: risk.recommendation,
      estimated_waste_cost: risk.estimated_waste_cost,
    };
  }));
  return { results };
}
