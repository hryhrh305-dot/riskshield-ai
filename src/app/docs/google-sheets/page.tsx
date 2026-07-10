import Link from "next/link";
import { Download, ExternalLink, Shield, TableProperties } from "lucide-react";

export default function GoogleSheetsGuidePage() {
  return (
    <div className="rs-shell">
      <header className="border-b border-white/10 bg-black/20 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Secwyn</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-slate-400 transition hover:text-white">API Docs</Link>
            <Link href="/dashboard" className="rounded-full border border-white/12 bg-white/8 px-4 py-2 font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/12">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-8">
          <div className="rs-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200">
            <TableProperties className="h-4 w-4" /> Spreadsheet Guide
          </div>
          <h1 className="rs-title-settle text-3xl font-semibold text-white sm:text-4xl">Google Sheets Setup Guide</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            This page is only for installing and using the Google Sheets add-on. It does not require you to read the API reference first.
          </p>
        </section>

        <div className="space-y-6">
          <section className="rs-card rounded-[28px] p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <a href="/api/google-sheets-addon" className="rs-button-primary rs-link-arrow inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
                <Download className="h-4 w-4" /> Download Code.gs
              </a>
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/12">
                Open Dashboard
              </Link>
            </div>
            <p className="text-sm text-slate-400">
              Before you start, make sure you already have a Secwyn account and a valid API key from your dashboard.
            </p>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Step-by-Step Installation</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-300">
              <li>Click <strong className="text-white">Download Code.gs</strong> on this page.</li>
              <li>Open the Google Sheet where you want to scan emails.</li>
              <li>In the top menu, click <strong className="text-white">Extensions</strong> &gt; <strong className="text-white">Apps Script</strong>.</li>
              <li>When the Apps Script editor opens, delete the sample code that is already there.</li>
              <li>Open the downloaded <strong className="text-white">Code.gs</strong> file on your computer.</li>
              <li>Copy everything from <strong className="text-white">Code.gs</strong> and paste it into the Apps Script editor.</li>
              <li>Click the <strong className="text-white">Save</strong> button in Apps Script.</li>
              <li>Go back to your Google Sheet and refresh the page.</li>
              <li>After refresh, look at the top menu and find <strong className="text-white">Secwyn</strong>.</li>
            </ol>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Connect Your API Key</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-300">
              <li>Open your Secwyn <Link href="/dashboard" className="text-white underline hover:text-slate-200">Dashboard</Link>.</li>
              <li>Find your API key and copy it.</li>
              <li>Return to Google Sheets.</li>
              <li>Click <strong className="text-white">Secwyn</strong> &gt; <strong className="text-white">Settings</strong>.</li>
              <li>Paste your API key into the API key field.</li>
              <li>Keep the default API base URL unless you were told to change it.</li>
              <li>Save the settings.</li>
            </ol>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              Google Sheets batch scanning uses the API. It requires a Growth, Scale, or Business plan.
            </div>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Run Your First Scan</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-300">
              <li>Put one email address in each row of a column in your sheet.</li>
              <li>Select the cells you want to scan.</li>
              <li>Click <strong className="text-white">Secwyn</strong> &gt; <strong className="text-white">Scan Selected Emails</strong>.</li>
              <li>Wait for the scan to finish.</li>
              <li>The add-on will write the results into new columns beside your selected emails.</li>
            </ol>
          </section>

          <section className="rs-card rounded-[28px] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Common Questions</h2>
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <div className="mb-1 font-medium text-white">I clicked the menu but nothing happened.</div>
                <p className="text-slate-400">Refresh the Google Sheet after saving the script. The custom menu only appears after reload.</p>
              </div>
              <div>
                <div className="mb-1 font-medium text-white">Google asks for authorization.</div>
                <p className="text-slate-400">That is normal the first time. Google Apps Script needs permission to run inside your sheet.</p>
              </div>
              <div>
                <div className="mb-1 font-medium text-white">I do not have an API key yet.</div>
                <p className="text-slate-400">Open the dashboard first, generate or copy your API key, then come back to the sheet settings.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">Need the API reference too?</p>
                <p className="mt-1 text-xs text-slate-500">The API docs stay separate so developers can jump straight into endpoints.</p>
              </div>
              <Link href="/docs" className="rs-link-arrow inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/12">
                Open API Docs <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-sm text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <a href="mailto:support@secwyn.com" className="transition hover:text-white">support@secwyn.com</a>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
