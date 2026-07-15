# Secwyn Google Sheets Add-on

1. Open Google Sheets
2. Extensions > Apps Script
3. Paste `Code.gs` and replace the Apps Script project's `appsscript.json` with the included manifest.
4. Save, authorize the requested spreadsheet, external-request, trigger, and UI scopes, then reload the sheet.
5. The Secwyn menu appears. Configure a Growth or Scale API key in **Secwyn → Settings**.
6. Use **Scan Selected Emails** or **Scan Entire Column**. A run supports up to 5,000 unique valid emails and sends 100-contact API requests in bounded parallel waves.
7. Use **Resume Saved Bulk Run** only for a paused internal/test run. Completed results are written with batch `setValues`; partial work is never labelled complete.

Before publishing publicly, test a separate internal Apps Script project with 101, 500, 2,500, 5,000, 5,001, duplicate, invalid, continuation, repeated-trigger, and partial-failure cases. Do not put any Supabase service key in Apps Script; only a user-scoped Secwyn API key is accepted.
