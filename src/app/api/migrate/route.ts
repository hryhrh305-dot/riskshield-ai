// DEPRECATED - Run SQL manually in Supabase Dashboard
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "DEPRECATED",
    message: "Run SQL manually in Supabase Dashboard -> SQL Editor",
    sqlFile: "supabase-migration.sql",
  });
}
