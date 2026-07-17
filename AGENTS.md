# Secwyn Repository Identity Lock

- Product: Secwyn
- Historical product name: RiskShield AI
- Canonical repository root: `D:\ai-saas-mvp`
- Expected Git root: `D:/ai-saas-mvp`
- Production domain: `https://www.secwyn.com`
- This repository is not Flowwyn.
- Never use `D:\flowwyn` for Secwyn work.
- Never use `J:\Documents\RiskShield AI` as the Secwyn repository.
- Historical repository or remote names containing `riskshield` still refer to Secwyn, not Flowwyn.
- Before any read, edit, test, commit, push, deploy, database, Supabase, Vercel, payment, or environment action, run `git rev-parse --show-toplevel`.
- If the result is not exactly `D:/ai-saas-mvp`, stop and report the mismatch.
- Do not inherit Flowwyn-specific phases, paths, Supabase identities, deployment rules, blueprints, or Skills.
- Project-specific instructions in this file override generic global workflow guidance when they conflict.

## Secwyn Current Product Constants

- Starter: 500 audited contacts per month
- Growth: 2,500 audited contacts per month
- Legacy Scale: 15,000 audited contacts per service month; referral reward 1,500
- Premium V2 Scale: 10,000 audited contacts per service month; referral reward 1,000
- Legacy and Premium V2 entitlements are selected from the immutable Creem Product ID/catalog-generation snapshot; public V2 pricing must not overwrite active Legacy subscribers
- New user default: 50 credits
- API Access: Growth and Scale only
- Google Sheets: Growth and Scale only
- Current production brand: Secwyn
- Old public domain `574269.xyz` is not part of Secwyn and must not be reattached or used as a Secwyn canonical domain.

## Project Rules for AI Coding Agents

1. Do NOT delete existing functionality without explicit user permission
2. Keep all API routes intact (v1, bulk-check, web-risk, etc.)
3. Scoring rules are sacred. Do not change point values or decision boundaries (0-25/26-65/66-100)
4. Google Sheets compatibility mandatory: batch-check must accept x-api-key header
5. DNS cache TTL = 7 days, do not reduce
6. Credit consumption must be server-side, never client-side
7. Supabase schema changes require migration scripts
8. Test before claiming completion: run build locally before pushing
9. Conversation with user in Chinese, website UI in English
10. Provide complete files, not patches
11. Push to GitHub triggers Vercel deploy automatically (warn user to wait ~30s)
12. Do not use xlsx dynamic import in browser (causes page crashes in Turbopack). Use static import at file top.

## Single Writer Multi-Agent Skill Reference

- Read `docs/SINGLE_WRITER_MULTI_AGENT_SKILL.md` before any multi-agent or harness-style task.
- Only one writer is allowed at a time; other agents are read-only unless the user explicitly approves otherwise.
- Do not create `.codex/agents/` in this repo.
