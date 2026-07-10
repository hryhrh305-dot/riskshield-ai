"use client";

import { ArrowRight, BadgeInfo, BarChart3, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ListAuditSummary } from "@/lib/list-audit";
import { formatAuditReport } from "@/lib/audit/report-format";

type AuditReportPreviewProps = {
  summary: ListAuditSummary;
  totalContacts: number;
  clientName?: string;
  campaignName?: string;
};

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "allow" | "review" | "block";
}) {
  const toneClasses =
    tone === "allow"
      ? "border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-200"
      : tone === "review"
        ? "border-amber-500/15 bg-amber-500/[0.08] text-amber-200"
        : tone === "block"
          ? "border-red-500/15 bg-red-500/[0.08] text-red-200"
          : "border-white/10 bg-white/[0.03] text-slate-100";

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

export function AuditReportPreview({
  summary,
  totalContacts,
  clientName = "Client",
  campaignName = "Outbound Campaign",
}: AuditReportPreviewProps) {
  const report = formatAuditReport(summary);
  const wastePrevented = summary.estimatedWastePrevented.riskySendsPrevented;

  return (
    <section className="rs-card rs-card-hover mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.045] to-black/[0.2]">
      <div className="border-b border-white/8 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              Client-ready Audit Report
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
              Pre-send List Audit Report
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              A client-ready campaign risk brief for outbound teams. This version converts the audit result into a launch decision, export-ready workflow, and agency-friendly summary.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              {report.summaryLine}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-slate-200">
              <BadgeInfo className="h-4 w-4 text-slate-400" />
              Audit metadata
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <div>Audit date: {report.generatedAtLabel}</div>
              <div>Client: {clientName}</div>
              <div>Campaign: {campaignName}</div>
              <div>Total contacts: {totalContacts}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Launch Status"
                value={report.launchStatusLabel}
                hint={report.listAcceptanceLabel}
                tone={summary.launchStatus === "ready_to_launch" ? "allow" : summary.launchStatus === "launch_with_caution" ? "review" : "block"}
              />
              <StatCard label="Campaign Readiness Score" value={report.readinessLabel} hint="Higher is safer for launch" />
              <StatCard label="List Acceptance" value={report.listAcceptanceLabel} hint="Client delivery recommendation" />
              <StatCard
                label="Waste Prevented"
                value={`${wastePrevented}`}
                hint="Risky sends removed from launch"
                tone={wastePrevented > 0 ? "review" : "neutral"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  Executive Summary
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">List Acceptance</div>
                    <div className="mt-1 font-medium text-white">{report.listAcceptanceLabel}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Client Risk Brief</div>
                    <p className="mt-1 leading-6 text-slate-300">{summary.clientRiskBrief}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <TriangleAlert className="h-4 w-4 text-amber-300" />
                  Top Risk Reasons
                </div>
                <div className="mt-3 space-y-2">
                  {summary.topRiskReasons.length > 0 ? (
                    summary.topRiskReasons.slice(0, 5).map((item) => (
                      <div key={item.reasonCode} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">{item.label}</div>
                          <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">{item.count}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{item.reasonCode}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">
                      No dominant risk reason was detected in this audit pass.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <FileText className="h-4 w-4 text-slate-400" />
                Send / Review / Suppress Breakdown
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">Send</div>
                  <div className="mt-1 text-xl font-semibold text-emerald-100">{summary.sendCount}</div>
                  <div className="mt-1 text-[11px] text-emerald-100/70">{Math.round(summary.sendRate * 100)}%</div>
                </div>
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.08] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">Review</div>
                  <div className="mt-1 text-xl font-semibold text-amber-100">{summary.reviewCount}</div>
                  <div className="mt-1 text-[11px] text-amber-100/70">{Math.round(summary.reviewRate * 100)}%</div>
                </div>
                <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.08] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-red-200/70">Suppress</div>
                  <div className="mt-1 text-xl font-semibold text-red-100">{summary.suppressCount}</div>
                  <div className="mt-1 text-[11px] text-red-100/70">{Math.round(summary.suppressRate * 100)}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ArrowRight className="h-4 w-4 text-slate-400" />
                Estimated Waste Prevented
              </div>
              <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                {report.wasteSnapshot}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <BadgeInfo className="h-4 w-4 text-slate-400" />
                Recommended Workflow
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {summary.recommendedWorkflow.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 leading-6">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Export
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use the export buttons above to download the Send Queue, Review Queue, Suppression List, and Risk Summary.
              </p>
              <Link href="/pricing" className="rs-link-arrow mt-4 inline-flex items-center gap-1 text-sm text-white hover:text-slate-200">
                Upgrade for bulk screening and reports <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
