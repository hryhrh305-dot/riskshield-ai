import Link from "next/link";
import { Download, ExternalLink, Shield, TableProperties } from "lucide-react";

export default function GoogleSheetsGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">RiskShield</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="text-gray-600 hover:text-gray-900">API Docs</Link>
          <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <TableProperties className="w-6 h-6 text-green-600" />
            <h1 className="text-3xl font-bold">Google Sheets Setup Guide</h1>
          </div>
          <p className="text-gray-500">
            This page is only for installing and using the Google Sheets add-on. It does not require you to read the API reference first.
          </p>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <a href="/api/google-sheets-addon" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Download className="w-4 h-4" /> Download Code.gs
            </a>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Open Dashboard
            </Link>
          </div>
          <p className="text-sm text-gray-600">
            Before you start, make sure you already have a RiskShield account and a valid API key from your dashboard.
          </p>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Step-by-Step Installation</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
            <li>Click <strong>Download Code.gs</strong> on this page.</li>
            <li>Open the Google Sheet where you want to scan emails.</li>
            <li>In the top menu, click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
            <li>When the Apps Script editor opens, delete the sample code that is already there.</li>
            <li>Open the downloaded <strong>Code.gs</strong> file on your computer.</li>
            <li>Copy everything from <strong>Code.gs</strong> and paste it into the Apps Script editor.</li>
            <li>Click the <strong>Save</strong> button in Apps Script.</li>
            <li>Go back to your Google Sheet and refresh the page.</li>
            <li>After refresh, look at the top menu and find <strong>Risk Scanner</strong>.</li>
          </ol>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Connect Your API Key</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
            <li>Open your RiskShield <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>.</li>
            <li>Find your API key and copy it.</li>
            <li>Return to Google Sheets.</li>
            <li>Click <strong>Risk Scanner</strong> &gt; <strong>Settings</strong>.</li>
            <li>Paste your API key into the API key field.</li>
            <li>Keep the default API base URL unless you were told to change it.</li>
            <li>Save the settings.</li>
          </ol>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Google Sheets batch scanning uses the API. It requires a Growth, Scale, or Business plan.
          </div>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Run Your First Scan</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
            <li>Put one email address in each row of a column in your sheet.</li>
            <li>Select the cells you want to scan.</li>
            <li>Click <strong>Risk Scanner</strong> &gt; <strong>Scan Selected Emails</strong>.</li>
            <li>Wait for the scan to finish.</li>
            <li>The add-on will write the results into new columns beside your selected emails.</li>
          </ol>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Common Questions</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <div className="font-medium text-gray-900 mb-1">I clicked the menu but nothing happened.</div>
              <p>Refresh the Google Sheet after saving the script. The custom menu only appears after reload.</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">Google asks for authorization.</div>
              <p>That is normal the first time. Google Apps Script needs permission to run inside your sheet.</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">I do not have an API key yet.</div>
              <p>Open the dashboard first, generate or copy your API key, then come back to the sheet settings.</p>
            </div>
          </div>
        </section>

        <section className="pb-10">
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-green-800">Need the API reference too?</p>
                <p className="text-xs text-green-700 mt-1">The API docs stay separate so developers can jump straight into endpoints.</p>
              </div>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-800 border border-green-300 hover:bg-green-100">
                Open API Docs <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
