# Secwyn India Affiliate implementation traceability

| Phase | Implementation evidence | Verification | Activation state |
|---|---|---|---|
| E0 | `SECWYN_AFFILIATE_E0_AUDIT.md` | Git/root/baseline, reuse and isolation audit | Complete |
| E1 | `handoff-v1.0.0/` | Package files and machine references retained | Complete |
| E2 | `src/modules/affiliate/` | Pure domain remains independent from React/Next/Supabase | Complete |
| E3 | Affiliate migration | 60 additive tables, 18 functions, seven explicit policies, RLS/revoke loop, immutable triggers and FK indexes | Local structural PASS; Preview execution blocked by migration transport |
| E4 | Registry, capabilities, rule schedule RPC | Launch/Evergreen 12-month boundary, immutable versions, ordered flags and 11% guard | Code PASS; publish call pending Preview DB |
| E5 | Applications and operator roles | India-only application, policy/quiz evidence, legal review state transitions and separated operator roles | Code PASS; flags off |
| E6 | Signed click and attribution routes | 30/90/120-day bounds, one canonical first customer, one generation, self-referral block | Code PASS; flags off |
| E7 | Calculators, transactional decision/reversal RPCs, ledger and payout gates | bigint/HALF_UP, schedules, reserve, refund/chargeback, replay and cumulative clawback guards | Unit/structural PASS; Real/Payout off |
| E8 | Content schema, Admin editor/API and seeder | Versioning, approval/publish separation, impact checker, schedule/rollback/import/export; 25 records and seven slots | Dry-run PASS; Preview apply pending |
| E9 | Affiliate, Leader and Admin surfaces | Server auth, role separation and aggregate-only leader contract | Build PASS; flags off |
| E10 | Payment sidecar and transactional outbox | Canonical payment re-read; Affiliate failure isolated from customer billing | Test PASS |
| E11 | Telegram policy, adapter and worker | Atomic claim, worker ownership, consent, qualified/paid+reconciled gates, retry/DLQ, unknown-delivery safety | Unit/structural PASS; external Bot and DB runtime pending |
| E12 | Immutable payout batches/items and payout gate | Minimum, 72-hour freeze, reconciliation, identity, reauth/PIN/OTP and kill switch | Code PASS; payout off |
| E13 | Affiliate and full regression suites | 49 files / 445 tests; build, lint, diff and dependency audit | PASS locally |
| E14 | Shadow acceptance suite and reconciliation job | 12 base combinations, refunds, chargebacks, referral, accelerator, team, rule switch, replay and concurrency | Simulation PASS; 30-event Preview runtime pending |
| E15 | Preview branch and Vercel configuration | Branch deployment and branch-scoped Preview variables; Production has no Affiliate variables | Safe flags-off Preview exists; refreshed branch deployment pending final commit |
| E16 | Security/quality evidence docs | Local gates complete; DB/runtime reports record the external transport block | Partial, fail closed |
| E17 | Final report | Template-aligned evidence and explicit HumanOps gates | Updated on final handoff |

The original machine traceability CSV remains unchanged at `handoff-v1.0.0/machine/24_REQUIREMENTS_TRACEABILITY_MATRIX.csv`.
