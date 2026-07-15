# Secwyn E8.6 Visible Copy Inventory

Date: 2026-07-15

Scope: current public, authentication, product-shell, administrative, metadata, email-template, Google Sheets, and export surfaces. Business logic and result contracts are inventory-only.

## Public acquisition surfaces

| Surface | Route | Source | E8.6 outcome |
|---|---|---|---|
| Homepage | `/` | `src/app/page.tsx`, `src/components/home/HomePageClient.tsx` | Reframed around second-line pre-send risk governance, high-value campaign approval, evidence boundaries, ICPs, workflow, sample audit, FAQ, and one-time 50-credit CTA. |
| Pricing | `/pricing` | `src/app/(dashboard)/pricing/page.tsx`, layout, `src/lib/plans.ts` | Plan prices and capacities unchanged; plan identity and cache/download explanations clarified. |
| API documentation | `/docs` | `src/app/docs/page.tsx`, layout | Positioned as the canonical pre-send decision API. Endpoint examples and access rules unchanged. |
| Google Sheets guide | `/docs/google-sheets` | page, layout, download route | Framed as the same decision workflow in Sheets. Installation and API-key instructions unchanged. |
| Privacy | `/privacy` | page, layout | Legal wording unchanged; shared theme coverage added. |
| Terms | `/terms` | page, layout | Legal wording unchanged; shared theme coverage added. |
| 404 | framework fallback | `src/app/not-found.tsx` | Added a concise on-brand recovery path. |

## Authentication and lifecycle surfaces

| Surface | Route | Source | E8.6 outcome |
|---|---|---|---|
| Sign in | `/login` | `src/app/(auth)/login/page.tsx` | Copy unchanged; noindex account metadata and shared theme coverage. |
| Sign up | `/signup` | `src/app/(auth)/signup/page.tsx` | Copy and referral behavior unchanged; shared theme coverage. |
| Forgot password | `/forgot-password` | page | Recovery behavior and copy unchanged; shared theme coverage. |
| Reset password | `/reset-password` | page | Recovery behavior and copy unchanged; shared theme coverage. |
| Billing success | `/dashboard/billing/success` | page | Behavior and copy unchanged; shared theme coverage. |

## Product and decision surfaces

| Surface | Route | Source | E8.6 outcome |
|---|---|---|---|
| Dashboard | `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | Metrics and behavior unchanged; shared light-theme tokens cover cards, navigation, alerts, forms, and tables. |
| Single contact/IP check | `/risk-check` | page, layout | Decision logic unchanged; metadata aligned to canonical decision model. |
| Web list audit | `/bulk-check` | page, layout | Upload, paste, drag/drop, progress, exports, 5,000 Web-run maximum, and credit behavior unchanged; metadata clarified. |
| Audit history | `/pre-send` | page, layout, API | Heading support copy aligned to approval evidence; data behavior unchanged. |
| Blacklist | `/blacklist` | page | Behavior and copy unchanged; theme coverage only. |
| E8 admin | `/admin/e8` | page | Operational copy, flags, and data behavior unchanged; theme coverage only. |
| Feedback admin | admin routes | page files | Behavior and copy unchanged; theme coverage only. |

## External and delivered output surfaces

| Surface | Source | Status |
|---|---|---|
| Google Sheets add-on dialog, menu, results | `google-sheets-addon/Code.gs` and download routes | No E8.6 code change. Existing limits, fields, continuation, and charging behavior preserved. |
| CSV/XLSX/Web result fields | bulk page, plans visibility, canonical decision model | No contract change. Existing export labels preserved. |
| Audit report preview | `src/components/audit/AuditReportPreview.tsx` | No E8.6 body or architecture change. |
| Supabase authentication emails | Supabase-managed templates | Out of scope; no E8.6 production configuration action. |
| Transactional/SES email | E8 infrastructure | Paused/out of scope; no claim that SES is active. |

## Shared chrome and metadata

- Root metadata now identifies Secwyn as pre-send risk governance.
- Existing route-specific canonical URLs remain on `https://www.secwyn.com`.
- Homepage header/footer now use the same product identity and evidence boundary.
- A global, persistent theme toggle covers public, authentication, product, and administrative shells without changing their layout or business behavior.

## Explicit non-copy findings

- No public `RiskShield` or `574269.xyz` identity remains in the audited active acquisition sources.
- The internal local-storage key used by password recovery is not visible product copy and was not renamed because authentication behavior is protected scope.
- `src/lib/plans.ts`, risk thresholds, credits, API access rules, payment behavior, referral behavior, Google Sheets mapping, and database code were not changed.
