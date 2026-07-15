# Secwyn E8.8 Cutover Architecture

```text
server flags -> select public catalog -> Pricing display
                                  -> server checkout policy -> mapped Product ID
Creem webhook Product ID -> recognize catalog entry -> subscription snapshot
                                               -> monthly credit grant
                                               -> referral reward snapshot
Dashboard/API/Sheets -> stored subscription + ledger -> entitlement
```

## Safety properties

- Legacy and V2 catalogs coexist; V2 never overwrites Legacy constants.
- Public pricing selection is independent from subscriber entitlement.
- Checkout accepts only plan and interval, then derives generation, price and Product ID server-side.
- Webhook recognizes configured entries across both catalogs and rejects unknown or ambiguous IDs.
- Credit and referral amounts come from the recognized subscription catalog entry.
- Rollback is flag-first: disable annual self-serve, then disable V2 pricing. Existing V2 subscribers remain recognizable.
- Production Product IDs, environment changes, payments and deployment are outside this local task.
