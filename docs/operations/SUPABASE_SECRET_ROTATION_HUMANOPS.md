# Supabase Secret API Key Rotation — Human Operations

Status: preparation only. Do not paste a key into this document, Git, chat, or Codex.

## Confirm the target

- Product: **Secwyn** (historical repository label: RiskShield AI).
- Supabase project ref: `njhjiavnidssjvnkcxfo`.
- Supabase project URL: `https://njhjiavnidssjvnkcxfo.supabase.co`.
- Vercel linked project: `riskshield-api` (project ID `prj_o5M4Hsumd0BYYvWntE1yZbjVAJkm`). Verify in the Vercel dashboard that it is the Secwyn production project before editing variables.
- Do not use Flowwyn, `D:\flowwyn`, or any historical J-drive repository.

## Create and stage the replacement

1. In the confirmed Supabase project, open **Settings → API Keys → Publishable and secret API keys**.
2. Create a new **Secret API key** named `secwyn-vercel-production-2026-07`.
3. Store it only in the approved password manager. Do not paste it into chat, Codex, tickets, source files, test fixtures, or logs.
4. In the confirmed Vercel project, open **Settings → Environment Variables** and add or update `SUPABASE_SECRET_KEY` as a Sensitive value.
5. Apply it to **Production** and **Preview**. Apply it to **Development** only if this Vercel project uses that environment.
6. In `D:\ai-saas-mvp\.env.local`, add `SUPABASE_SECRET_KEY` locally. This file is ignored and must never be committed.
7. Leave the legacy `service_role` key enabled. Do not rotate the legacy JWT signing secret.

## Validation and retirement order

1. Redeploy the current production version that does not depend on the unexecuted Bulk Run migration.
2. Verify server-side authenticated operations and relevant Vercel function logs without printing credentials.
3. Confirm the replacement key works in the current deployment before disabling the old `service_role` key.
4. Disable the old key only after that verification succeeds. Deletion is irreversible.
5. If validation fails, restore the prior Vercel environment value, redeploy the prior application version, and keep the old key enabled while investigating.

## Release guardrails

- Phase B2 remains unpushed and undeployed until the replacement key is verified and the old key is disabled.
- The Bulk Run migration remains unexecuted until the key cutover succeeds and a separate production migration preflight is approved.
- This is not a Task 2D, scoring, Creem, referral, SEO, or canonical change.
