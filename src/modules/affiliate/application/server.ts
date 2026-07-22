import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireAffiliateUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("AFFILIATE_AUTH_REQUIRED");
  return data.user;
}

export async function loadAffiliateMembership(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("affiliate_memberships").select("*").eq("program_id", "secwyn-india").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("AFFILIATE_MEMBERSHIP_UNAVAILABLE");
  return data;
}

export async function loadAffiliateBalance(membershipId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("affiliate_ledger_entries").select("amount_minor,entry_type,effective_at").eq("program_id", "secwyn-india").eq("affiliate_id", membershipId).eq("posting_state", "payable").lte("effective_at", new Date().toISOString());
  if (error) throw new Error("AFFILIATE_LEDGER_UNAVAILABLE");
  return (data || []).reduce((sum, row) => sum + BigInt(row.amount_minor), 0n);
}

export async function loadAffiliateLeaderSummary(membershipId: string) {
  const admin = getSupabaseAdminClient();
  const { data: team, error: teamError } = await admin
    .from("affiliate_teams")
    .select("id,name,status")
    .eq("program_id", "secwyn-india")
    .eq("leader_id", membershipId)
    .maybeSingle();
  if (teamError) throw new Error("AFFILIATE_TEAM_UNAVAILABLE");
  if (!team) return null;

  const [members, months] = await Promise.all([
    admin
      .from("affiliate_team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .is("left_at", null),
    admin
      .from("affiliate_team_months")
      .select("performance_month,qualified_sales_minor,leader_personal_independent_orders")
      .eq("team_id", team.id)
      .order("performance_month", { ascending: false })
      .limit(6),
  ]);
  if (members.error || months.error) throw new Error("AFFILIATE_TEAM_UNAVAILABLE");

  return {
    id: team.id,
    name: team.name,
    status: team.status,
    directActiveMembers: members.count || 0,
    months: (months.data || []).map((month) => ({
      performanceMonth: month.performance_month,
      qualifiedSalesMinor: String(month.qualified_sales_minor),
      leaderPersonalIndependentOrders: month.leader_personal_independent_orders,
    })),
  };
}

export async function loadPublishedAffiliateContent(contentTypes?: readonly string[]) {
  const admin = getSupabaseAdminClient();
  let itemsQuery = admin.from("affiliate_content_items").select("id,content_key,content_type,locale").eq("program_id", "secwyn-india").eq("locale", "en");
  if (contentTypes?.length) itemsQuery = itemsQuery.in("content_type", [...contentTypes]);
  const { data: items, error: itemsError } = await itemsQuery;
  if (itemsError) throw new Error("AFFILIATE_CONTENT_UNAVAILABLE");
  const ids = (items || []).map((item) => item.id);
  if (!ids.length) return [];
  const { data: versions, error } = await admin.from("affiliate_content_versions").select("content_id,version,body,published_at").in("content_id", ids).eq("status", "published").lte("published_at", new Date().toISOString()).order("version", { ascending: false });
  if (error) throw new Error("AFFILIATE_CONTENT_UNAVAILABLE");
  const latest = new Map<string, (typeof versions)[number]>();
  for (const version of versions || []) if (!latest.has(version.content_id)) latest.set(version.content_id, version);
  return (items || []).flatMap((item) => { const version=latest.get(item.id); return version ? [{ ...item, version:version.version, body:version.body }] : []; });
}
