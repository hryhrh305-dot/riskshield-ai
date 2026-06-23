import { NextResponse } from "next/server";
import { getCreemEnvDebugInfo } from "@/lib/creem";

export async function GET() {
  return NextResponse.json(getCreemEnvDebugInfo());
}
