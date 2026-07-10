import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { Mail, Search, Shield, ArrowLeft, Inbox } from "lucide-react";

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

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <div className="rs-shell">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Admin</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Feedback Inbox</h1>
            <p className="mt-1 text-sm text-slate-400">Review user feedback submitted from the dashboard.</p>
          </div>
          <Link href="/dashboard" className="rs-button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rs-panel rounded-[24px] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Total feedback</div>
            <div className="mt-3 text-3xl font-semibold text-white">{(totalCount || 0).toLocaleString()}</div>
          </div>
          <div className="rs-panel rounded-[24px] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Sent today</div>
            <div className="mt-3 text-3xl font-semibold text-white">{(todayCount || 0).toLocaleString()}</div>
          </div>
          <div className="rs-panel rounded-[24px] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Admin email</div>
            <div className="mt-3 break-all text-sm font-medium text-slate-100">{user.email}</div>
          </div>
        </section>

        <section className="rs-card rounded-[28px] p-5">
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="q">
            Search feedback
          </label>
          <form className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Search by email, subject, or message"
                className="rs-input pl-10 pr-3 py-3 text-sm"
              />
            </div>
            <button type="submit" className="rs-button-primary min-h-11 rounded-full px-4 py-2 text-sm font-medium">
              Filter
            </button>
          </form>
        </section>

        <section className="rs-card rounded-[28px] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              <Inbox className="h-4 w-4" />
              Submissions
            </h2>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Mail className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">No feedback found.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {rows.map((row) => (
                <article key={row.id} className="px-5 py-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white">{row.subject}</h3>
                      <div className="mt-1 break-all text-sm text-slate-400">
                        {row.email || "Unknown email"}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">
                      {new Date(row.created_at).toLocaleString()}
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-200">{row.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/feedback?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
              aria-disabled={!hasPrev}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium ${
                hasPrev
                  ? "rs-button-secondary"
                  : "pointer-events-none rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-600"
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/admin/feedback?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={!hasNext}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium ${
                hasNext
                  ? "rs-button-secondary"
                  : "pointer-events-none rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-600"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
