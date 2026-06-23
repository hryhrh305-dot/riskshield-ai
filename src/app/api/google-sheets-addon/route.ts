import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const scriptPath = path.join(process.cwd(), "google-sheets-addon", "Code.gs");
  const script = await readFile(scriptPath, "utf8");

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="RiskShield-Google-Sheets-Code.gs"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
