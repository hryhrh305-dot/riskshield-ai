## Current State - RiskShield AI v0.3 (2026-06-22)

### Vercel Scope
- Team display name: H Projects
- Team URL / slug: hrh-projects
- Future Vercel CLI scope: --scope hrh-projects
- Vercel project name: riskshield-api
- GitHub repo: hryhrh305-dot/riskshield-ai
- Production domains: 574269.xyz, www.574269.xyz
- Historical deployment URLs may still include the old `risk-shield-ai` slug, but future CLI and team references should use `hrh-projects`

### Completed
- Email/IP risk scoring engine (ALLOW/REVIEW/BLOCK)
- Website: single check, bulk upload, dashboard, pricing
- Google Sheets add-on (private, working)
- API v1 with API key auth (5 endpoints)
- Supabase auth + database
- Creem payment integration
- DNS caching (7-day TTL)
- 7565+ disposable domains
- Input sanitization (RFC 5321)

### In Progress
- XLSX download stability (985df12 deployed, needs verification)
- Clean CSV fix (985df12 deployed, needs verification)

### Blocked
- Vercel timeout on large batches (need async worker)

### Next
1. Verify latest deploy 2. Async worker 3. Company intelligence 4. GS Marketplace
