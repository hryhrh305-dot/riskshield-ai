# Secwyn E8.8 Implementation

## Implemented locally

- Added a canonical dual billing catalog with immutable Legacy and Premium V2 monthly/annual entries.
- Added strict server-only pricing and annual self-serve flags; missing/invalid values are false.
- Added distinct V2 Product ID environment schema and duplicate-ID rejection.
- Added a no-secret public Pricing catalog endpoint so the client displays the server-selected catalog without exposing Product IDs.
- Made Checkout derive catalog generation, amount and Product ID server-side. V2 Scale annual is contact-only.
- Extended Webhook product recognition across both generations and rejects product/plan mismatch.
- Extended annual service-month identity with term anchor, month index, generation, interval and grant type while reusing the existing atomic ledger/RPC.
- Made annual renewal reset the annual term anchor; monthly subscriptions keep their original monthly anchor.
- Snapshotted referral rewards by recognized catalog generation and interval.
- Returned authenticated subscription entitlement from the existing referral summary endpoint so Dashboard shows Legacy Scale 15,000 and V2 Scale 10,000 from the stored Product ID.
- Updated Pricing, FAQ and Terms and removed the unsupported numeric Campaign Readiness claim and old two-month promotion.

## Deliberately unchanged

No migration, risk score, decision boundary, DNS TTL, API/Sheets gate, cache charging, report credit behavior, Auth flow, Portal route, production environment, Creem product, payment, push or deployment was changed.
