# Secwyn Google Canonical Migration Operator Guide

## Purpose

Make `https://www.secwyn.com/` the only public canonical for Secwyn and preserve the historical `574269.xyz` domain solely as a permanent migration redirect for at least one year.

## Current verified state

- `https://www.secwyn.com/` and the checked public pages return `200` with self-referencing `www.secwyn.com` canonical and Open Graph URLs.
- `https://www.secwyn.com/sitemap.xml` contains only `https://www.secwyn.com/...` URLs.
- `https://www.secwyn.com/robots.txt` permits public crawling and points to the `www.secwyn.com` sitemap.
- `574269.xyz` and `www.574269.xyz` are not assigned to the current Secwyn Vercel project. Their HTTPS endpoints return `404`; they are not currently redirects.
- The old apex currently has a third-party-hosting DNS answer, while the old `www` record resolves through Vercel DNS. Do not assume either record is correct for a redirect until Vercel verifies the domain.

## Required Vercel action

Perform this only in the Vercel account or team that owns `574269.xyz`. The current Secwyn Vercel project cannot access or reassign the old domain by itself.

1. Open the current Secwyn Vercel project, historically named `riskshield-api`.
2. Go to **Settings → Domains**.
3. Add both `574269.xyz` and `www.574269.xyz` as legacy migration domains. If Vercel says the domain belongs to another account or project, complete its displayed TXT ownership-verification step in the registrar first; do not use force reassignment unless you have confirmed ownership and the current owner is the old legacy setup.
4. Wait until Vercel marks both domains as configured and TLS-ready.
5. Edit each old domain in **Settings → Domains** and set **Redirect to** `www.secwyn.com`.
6. Confirm the redirect is permanent (`301` or `308`) and preserves the request path and query string.
7. Keep `www.secwyn.com` as the production domain. Do not set either old domain as a Production domain, Canonical domain, or public content host.

The old domain is a redirect-only migration asset. It must never serve a duplicate Secwyn homepage, pricing page, promotion page, or new announcement page.

## DNS guardrails

1. Use the exact DNS values displayed by Vercel after adding each legacy domain. Do not substitute a generic Vercel IP address or a copied record from another domain.
2. For the apex, remove conflicting apex A/AAAA/ALIAS records only when the Vercel domain card explicitly identifies them as conflicting.
3. For `www`, retain only the CNAME value Vercel shows for the legacy-domain binding; remove conflicting `www` A, AAAA, or CNAME records only after recording the current value and confirming the Vercel replacement.
4. Do not change any DNS record for `secwyn.com` or `www.secwyn.com` during this operation.
5. Wait for Vercel TLS to become ready before testing HTTPS. DNS propagation can take time.

## Acceptance matrix

After Vercel reports both legacy domains ready, test without a browser cache:

| Start URL | Required final URL | Maximum chain |
| --- | --- | ---: |
| `http://574269.xyz/` | `https://www.secwyn.com/` | 2 hops |
| `https://574269.xyz/` | `https://www.secwyn.com/` | 1 hop |
| `http://www.574269.xyz/` | `https://www.secwyn.com/` | 2 hops |
| `https://www.574269.xyz/` | `https://www.secwyn.com/` | 1 hop |
| `https://www.574269.xyz/pricing` | `https://www.secwyn.com/pricing` | 1 hop |
| `https://www.574269.xyz/docs` | `https://www.secwyn.com/docs` | 1 hop |
| `https://www.574269.xyz/privacy` | `https://www.secwyn.com/privacy` | 1 hop |

Use a header-only request and confirm `301` or `308`, a `Location` header to the corresponding `https://www.secwyn.com` URL, and no loop. A missing equivalent destination should return a relevant `404` or `410`, not redirect unrelated content to the home page.

## Google Search Console procedure

1. Verify Domain properties for both `574269.xyz` and `secwyn.com`; verify the URL-prefix property for `https://www.secwyn.com/` if it is not already available.
2. In the old-domain property, open **Settings → Change of address**.
3. Select `secwyn.com` as the destination property, then complete the validation steps only after permanent redirects are live.
4. In the new-domain property, submit `https://www.secwyn.com/sitemap.xml`.
5. Use URL Inspection to test the old homepage and a representative old path. They must report a permanent redirect to the matching new URL.
6. Inspect `https://www.secwyn.com/`, confirm that Google can fetch it, and request indexing once.
7. If Search Console says a submission request failed, wait and retry later. Do not submit large batches repeatedly.
8. Over the following weeks, monitor the user-declared and Google-selected canonical for the homepage and key public pages.

## Rollback

If an old-domain redirect causes a loop or points to the wrong host:

1. In Vercel Domain settings, remove only the redirect configuration for the affected old domain.
2. Do not alter `www.secwyn.com`, billing, application environment variables, or production code.
3. Correct the legacy-domain redirect configuration, wait for TLS/DNS readiness, and retest the affected path.

## Long-term rule

Keep the old-domain redirects for at least one year. Future promotional pages belong under `https://www.secwyn.com/offers` or an explicitly approved Secwyn subdomain, never under `574269.xyz`.

## P2 follow-up

After the HumanOps domain binding is complete, add an automated external redirect-monitoring check for the eight entry URLs and the representative legacy paths. This is not implemented by this guide.
