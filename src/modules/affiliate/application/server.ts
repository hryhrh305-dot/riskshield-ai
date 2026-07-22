import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export type AffiliateOperatorRole = "content_editor"|"compliance_reviewer"|"program_manager"|"publisher"|"affiliate_admin"|"super_admin";

export async function requireAffiliateUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("AFFILIATE_AUTH_REQUIRED");
  return data.user;
}

export async function requireAffiliateOperator(allowedRoles:readonly AffiliateOperatorRole[]) {
  const user=await requireAffiliateUser();
  if(isAdminEmail(user.email)&&allowedRoles.includes("super_admin")) return {user,role:"super_admin" as const};
  const admin=getSupabaseAdminClient();
  const {data,error}=await admin.from("affiliate_operator_roles").select("role").eq("program_id","secwyn-india").eq("user_id",user.id).is("revoked_at",null).in("role",[...allowedRoles]).limit(1).maybeSingle();
  if(error||!data) throw new Error("AFFILIATE_OPERATOR_FORBIDDEN");
  return {user,role:data.role as AffiliateOperatorRole};
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

export async function loadAffiliateApplicationState(userId:string){
  const admin=getSupabaseAdminClient();
  const {data:application,error}=await admin.from("affiliate_applications").select("id,status,review_reason,created_at,updated_at").eq("program_id","secwyn-india").eq("user_id",userId).maybeSingle();
  if(error) throw new Error("AFFILIATE_APPLICATION_UNAVAILABLE");
  if(!application) return null;
  const {data:quiz,error:quizError}=await admin.from("affiliate_quiz_attempts").select("score,passed,created_at").eq("application_id",application.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(quizError) throw new Error("AFFILIATE_APPLICATION_UNAVAILABLE");
  return {...application,quiz};
}

export async function loadAffiliateWorkspace(membershipId:string){
  const admin=getSupabaseAdminClient();
  const [actions,events,direct,payoutAccount,payoutItems,resources]=await Promise.all([
    admin.from("affiliate_activation_actions").select("action_type,format,occurred_at").eq("membership_id",membershipId).order("occurred_at",{ascending:false}),
    admin.from("affiliate_activation_events").select("event_type,format,occurred_at").eq("membership_id",membershipId).order("occurred_at",{ascending:false}),
    admin.from("affiliate_referral_relationships").select("created_at,affiliate_memberships!affiliate_referral_relationships_invitee_id_fkey(affiliate_code,status)").eq("program_id","secwyn-india").eq("inviter_id",membershipId),
    admin.from("affiliate_payout_accounts").select("provider,status,verified_at,payout_account_changed_at:updated_at").eq("membership_id",membershipId).maybeSingle(),
    admin.from("affiliate_payout_items").select("amount_minor,status,created_at,affiliate_payout_batches!inner(period_start,period_end,status,reconciled_at)").eq("affiliate_id",membershipId).order("created_at",{ascending:false}).limit(6),
    loadPublishedAffiliateContent(["training","resource_link","approved_script","faq"]),
  ]);
  if(actions.error||events.error||direct.error||payoutAccount.error||payoutItems.error) throw new Error("AFFILIATE_WORKSPACE_UNAVAILABLE");
  return {actions:actions.data||[],events:events.data||[],directRelationships:direct.data||[],payoutAccount:payoutAccount.data||null,payoutItems:payoutItems.data||[],resources};
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
