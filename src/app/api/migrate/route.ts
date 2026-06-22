// This endpoint is deprecated.
// Supabase DDL cannot be executed from Vercel serverless functions.
// Go to Supabase Dashboard -> SQL Editor and run the SQL manually.
// See: supabase-migration.sql for the full SQL.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "DEPRECATED",
    message: "Run SQL manually in Supabase Dashboard -> SQL Editor.",
    sqlFile: "supabase-migration.sql",
    instructions: "1. Go to https://supabase.com/dashboard
2. Select your project
3. Open SQL Editor
4. Copy SQL from supabase-migration.sql
5. Click Run",
  });
}
