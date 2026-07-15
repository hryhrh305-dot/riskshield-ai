# Secwyn E8.6 Copy Risk Notes

## Resolved in E8.6

1. **Commodity-validator positioning** — the old homepage led with list intelligence and risk detection. It now leads with campaign approval, operational queues, and traceable evidence.
2. **Unsupported AI label** — the illustrative homepage card used “AI Risk Summary” even though the preview was static. It is replaced with a clearly labeled illustrative decision-evidence sample.
3. **Illustrative evidence ambiguity** — the sample is explicitly fictional and not a real customer report.
4. **Future capability ambiguity** — signup/form-abuse review is labeled as developing and not production-ready.
5. **Free allowance ambiguity** — public CTA and FAQ state that 50 credits are a one-time account allowance, not monthly.
6. **Cache charging ambiguity** — pricing explains that cached results remain chargeable because they provide the same usable decision, while downloads do not consume another credit.
7. **Unsupported Scale priority language** — the active Scale card no longer advertises priority processing while that comparison row remains marked “Coming soon.”

## Deliberately bounded claims

- Secwyn supports a launch decision; it does not guarantee inbox placement, delivery, sender reputation, campaign revenue, or fraud prevention.
- Available signals vary by workflow, plan, network response, cache state, and enabled production configuration.
- Unknown and unavailable signals must remain explicit.
- Paid-vendor data must not be described as used unless the request actually queried it.
- The Web app currently allows up to 5,000 contacts in one user run; monthly plan capacity is a separate limit.
- API and Google Sheets access are Growth and Scale capabilities; Business is custom.

## Protected wording and behavior

- Decision boundaries remain ALLOW 0–25, REVIEW 26–65, BLOCK/SUPPRESS 66–100.
- Existing product surfaces may use `ALLOW/BLOCK` internally while marketing uses `SEND/SUPPRESS`; canonical mapping is unchanged.
- Prices, recurring allowances, annual-cycle behavior, referral rewards, credits, cache charging, and export behavior remain source-controlled business facts and were not altered by copy work.

## Known baseline considerations

- Existing repository lint/typecheck debt is documented in E8.5 and measured again before E8.6.
- Supabase and SES email-template content is not versioned as ordinary page source and was not changed.
- Authenticated screenshots must not use production credentials or trigger production-side effects merely to create evidence.
