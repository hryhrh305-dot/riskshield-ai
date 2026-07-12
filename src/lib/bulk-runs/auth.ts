import type { NextRequest } from "next/server";
import { readAccessTokenFromCookieHeader } from "@/lib/auth-cookie";
import { isPlanAtLeast } from "@/lib/plans";
import { getBulkRunAdmin } from "./repository";
import { BulkRunServiceError } from "./errors";

export type BulkRunActor = { userId: string; source: "web" | "sheets" | "api"; plan: string };

export async function resolveBulkRunActor(request: NextRequest): Promise<BulkRunActor> {
  const admin = getBulkRunAdmin();
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const { data: key } = await admin.from("api_keys").select("user_id,status").eq("key", apiKey).eq("status", "active").maybeSingle();
    if (!key) throw new BulkRunServiceError("INVALID_API_KEY", 401, "Invalid API key.");
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", key.user_id).maybeSingle();
    if (!profile || !["growth", "scale"].includes(String(profile.plan).toLowerCase())) throw new BulkRunServiceError("PLAN_RESTRICTION", 403, "Bulk API access requires Growth or Scale.");
    return { userId: key.user_id, source: "sheets", plan: profile.plan };
  }
  const token = readAccessTokenFromCookieHeader(request.headers.get("cookie") || "", "njhjiavnidssjvnkcxfo");
  if (!token) throw new BulkRunServiceError("AUTHENTICATION_REQUIRED", 401, "Please log in.");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new BulkRunServiceError("AUTHENTICATION_REQUIRED", 401, "Please log in.");
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = profile?.plan ?? "free";
  if (!isPlanAtLeast(plan, "starter")) throw new BulkRunServiceError("PLAN_RESTRICTION", 403, "Bulk list screening starts on Starter.");
  return { userId: user.id, source: "web", plan };
}
