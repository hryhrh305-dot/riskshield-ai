import { readFile } from "node:fs/promises";
import { analyzeDecisionRows, parseSanitizedDecisionCsv } from "../src/lib/decision-utility-analysis.ts";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/e8-8r-review-distribution.mjs <sanitized-results.csv>");
  process.exitCode = 1;
} else {
  try {
    const csv = await readFile(inputPath, "utf8");
    console.log(JSON.stringify(analyzeDecisionRows(parseSanitizedDecisionCsv(csv)), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
