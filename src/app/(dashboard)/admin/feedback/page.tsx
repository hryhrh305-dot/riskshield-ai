import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { Mail, Search, Shield, ArrowLeft } from "lucide-react";

type FeedbackRow = {
  id: string;
  user_id: string;
  email: string | null;
  subject: string;
  message: string;
  created_at: string;
};

type Props = {
  searchParams?: Promise<{ q?: string; page?: string }>;
};

const PAGE_SIZE = 25;

export default async function AdminFeedbackPage({ searchParams }: Props) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?reason=invalid_session&next=/admin/feedback");
  }

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) || {};
  const q = (params.q || "").trim();
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const adminClient = await createServiceClient();
  let query = adminClient
    .from("feedback_messages")
    .select("id,user_id,email,subject,message,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`subject.ilike.%${q}%,message.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, count } = await query;
  const rows = (data || []) as FeedbackRow[];
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const [{ count: todayCount }, { count: totalCount }] = await Promise.all([
    adminClient
      .from("feedback_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayIso),
    adminClient.from("feedback_messages").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-blue-600">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Admin</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Feedback Inbox</h1>
            <p className="text-sm text-gray-500">Review user feedback submitted from the dashboard form.</p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Total feedback</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{(totalCount || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Sent today</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{(todayCount || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Admin email</div>
            <div className="mt-2 break-all text-sm font-medium text-gray-900">{user.email}</div>
          </div>
        </div>

        <form className="rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="q">Search</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Search by email, subject, or message"
                className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Filter
            </button>
          </div>
        </form>

        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Mail className="h-4 w-4" />
              Submissions
            </h2>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-sm text-gray-500">No feedback found.</div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={row.id} className="px-4 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium text-gray-900">{row.subject}</div>
                    <div className="text-xs text-gray-400">{new Date(row.created_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{row.email || "Unknown email"}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{row.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/feedback?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
              aria-disabled={!hasPrev}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                hasPrev ? "bg-white text-gray-700 hover:bg-gray-50" : "pointer-events-none border-gray-200 bg-gray-100 text-gray-400"
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/admin/feedback?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={!hasNext}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                hasNext ? "bg-white text-gray-700 hover:bg-gray-50" : "pointer-events-none border-gray-200 bg-gray-100 text-gray-400"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
