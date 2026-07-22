# Secwyn India Affiliate implementation traceability

| Phase | Implementation evidence | Verification | Activation state |
|---|---|---|---|
| E0 | `SECWYN_AFFILIATE_E0_AUDIT.md` | Git/root/baseline and reuse audit | Complete |
| E1 | `handoff-v1.0.0/` | 39 copied files; manifest hashes previously verified | Complete |
| E2 | `src/modules/affiliate/` | Pure domain has no React/Next/Supabase imports | Complete |
| E3 | `202607220001_india_affiliate_platform.sql` | 59 additive `affiliate_` tables, RLS loop, 14 functions, immutable triggers | Preview execution gated |
| E4 | `programs/registry.ts`, `capabilities.ts`, `rewards.ts` | Launch/Evergreen, 11% Evergreen cap vectors, ordered flags | Complete; launch time HumanOps |
| E5 | applications API/page and transactional review RPC | India-only, five-question quiz, policy evidence, 7/3/90-day fields | Complete; flags off |
| E6 | signed click route, attribution API/RPC | 30/90/120-day locks, canonical customer, one generation, self-referral block | Complete; key/flag gated |
| E7 | commission/audit/reward/payout domains; shadow/release/reconciliation jobs | bigint/HALF_UP, 12 base combinations, refunds/disputes, replay/concurrency | Complete; Real/Payout off |
| E8 | content schema, Admin editor/API, seeder, impact checker | immutable versions, approval, schedule, rollback, export, Preview seed | Complete; seed gated |
| E9 | public/apply/rules/anti-scam/Affiliate portal/aggregate-only Leader/Admin/Content Admin pages | server auth, ordered flags, Leader privacy contract and build route evidence | Complete operational surfaces; external data remains gated |
| E10 | payment sidecar, transactional RPCs, outbox/DLQ workers | canonical payment re-read; Affiliate failures do not roll back payment | Complete |
| E11 | Telegram policy/port/dispatcher/worker | consent, qualified/paid+reconciled, unknown delivery, retry/DLQ, six slots | Mock complete; Bot HumanOps |
| E12 | payout tables, immutable snapshots, pure payout gate | $50, 72h, reconciliation, reauth/PIN/OTP, kill switch | Code/schema ready; real Payoneer HumanOps |
| E13 | four Affiliate test suites plus existing full Vitest | 49 files / 442 tests, no skipped/only; representative critical mutations killed | Complete locally |
| E14 | `affiliate-shadow-acceptance.test.ts`, shadow and reconciliation jobs | 12 combinations, 5 refunds, 2 chargebacks, 3 referral, 2 accelerator, 2 team, switch/freeze, 100 replay, concurrency | Simulation complete; real 30-event Shadow gated |
| E15 | Operator guide and flags-off local smoke | `/` and `/pricing` 200; Affiliate surfaces/API 404 | Local complete; Preview DB/deploy gated |
| E16 | lint, typecheck delta, tests, build, diff/secret/flag scans | recorded in Final Report | Complete except DB runtime/dependency audit network gate |
| E17 | `SECWYN_AFFILIATE_FINAL_REPORT.md` | Template-aligned evidence | Complete |

The original machine traceability CSV remains unchanged under `handoff-v1.0.0/machine/24_REQUIREMENTS_TRACEABILITY_MATRIX.csv`. Production is not enabled by this implementation.
