# Secwyn E8.8R Preview Pricing and Copy Acceptance

Status: accepted for the pre-payment Preview Human Gate.

Preview deployment: `https://riskshield-iunj9ik0z-hrh-projects.vercel.app`

Evidence boundary: Vercel reported the deployment Ready and direct Preview HTTP/API checks passed. The Codex in-app browser reset connections to all external domains (including `www.secwyn.com`), so responsive/theme/console checks were completed against the same production build with the two Preview V2 pricing flags enabled locally. No Production environment or data was used.

Acceptance checklist:

- [x] Monthly shows $199 / $999 / $3,999 and 500 / 2,500 / 10,000.
- [x] Annual shows $2,189 / $10,989 / $43,989.
- [x] Annual wording states “12 months for the price of 11”, billed annually in USD, credits issued monthly.
- [x] Starter/Growth annual self-serve state follows the server flag and mappings.
- [x] Scale annual is Contact Secwyn, never public self-serve.
- [x] Free shows 50 one-time and routes to signup/single Contact Check entitlement, not list audit.
- [x] Growth+ API and Google Sheets entitlement copy is consistent.
- [x] Premium V2 pages and API use Scale 10,000; Legacy 15,000 remains isolated to the Legacy catalog.
- [x] Desktop/mobile and light/dark have no horizontal overflow, console error or hydration error in the equivalent production build.

Online Preview route results:

- public routes (`/`, `/pricing`, `/login`, `/signup`, `/docs`, `/docs/google-sheets`, `/terms`, `/privacy`): HTTP 200;
- protected routes (`/dashboard`, `/risk-check`, `/bulk-check`, `/pre-send`): HTTP 307 to `/login` without a session;
- unknown route: HTTP 404;
- `/api/pricing-catalog`: Premium V2 contract with Starter/Growth checkout enabled, Scale annual contact-led;
- unauthenticated checkout and customer portal POSTs: HTTP 401 with `Please sign in first.`
