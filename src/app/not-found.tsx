import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { SecwynMark } from "@/components/brand/SecwynMark";

export default function NotFound() {
  return (
    <main className="rs-shell flex min-h-screen items-center justify-center px-4 py-16">
      <section className="rs-panel-strong w-full max-w-xl rounded-[30px] p-8 text-center sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <SecwynMark className="h-6 w-6 text-white" />
        </div>
        <SearchX className="mx-auto mt-8 h-8 w-8 text-slate-400" />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">404 · Page not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">This decision path does not exist.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-300">Return to Secwyn to continue reviewing campaigns before the first send.</p>
        <Link href="/" className="rs-button-primary mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Return home</Link>
      </section>
    </main>
  );
}
