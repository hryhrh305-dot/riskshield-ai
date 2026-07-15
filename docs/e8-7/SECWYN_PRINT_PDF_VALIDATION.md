# Secwyn E8.7 Print and PDF Validation

Date: 2026-07-15

## Implementation boundary

- PDF delivery uses the browser's native **Print / Save PDF** capability. No PDF SDK, AI service or paid vendor was added.
- Download HTML creates a local Blob from the already returned audit result. Print and download do not call a scan route and consume zero additional credits.
- The generated HTML is self-contained: embedded styles, no remote font, image, script or tracking dependency.
- User-controlled text is HTML-escaped before insertion.

## Print behavior

- Print output switches to a white background with dark text and visible borders regardless of the application theme.
- Navigation, controls and other page content are hidden while the report remains visible.
- Table headers repeat where the browser supports it.
- Key cards and short report sections avoid page breaks where practical.
- Contact rows are not truncated from the downloadable HTML or print artifact.

## Verified states

- Mixed Send / Review / Suppress
- All Send
- All Review
- All Suppress
- Empty result
- Partial result with explicit reconciliation limitation
- Lookup-failed evidence shown as failed, not converted to a positive conclusion
- 500-contact artifact
- Desktop and mobile layout
- Light print/PDF preview

## Screenshots

All evidence is stored under `docs/e8-7/screenshots/`:

- `actual-report-mixed-desktop.png`
- `actual-report-mixed-mobile.png`
- `actual-report-all-send.png`
- `actual-report-all-review.png`
- `actual-report-all-suppress.png`
- `actual-report-empty.png`
- `actual-report-partial.png`
- `actual-report-lookup-failed.png`
- `actual-report-500-contact-fixture.png`
- `print-pdf-preview.png`
- `bulk-auth-boundary-dark.png`
- `bulk-auth-boundary-light.png`
- `single-auth-boundary-dark.png`
- `single-auth-boundary-light.png`
- `history-auth-boundary-dark.png`
- `history-auth-boundary-light.png`
- `homepage-sample-light.png`

## Known evidence boundary

The screenshots use deterministic `.invalid` fixture addresses through the production report builder. Protected result pages were verified only through their local authentication boundary because no production account/session was used or authorized. The report artifact itself is the real E8.7 HTML formatter, not a design mockup.

Public browser smoke also covered `/`, `/pricing`, `/docs`, `/docs/google-sheets` and `/login`; all returned HTTP 200 without page errors or horizontal document overflow.
