# Secwyn E8 Cutover Phase A — Creem Test Coupon Acceptance

Verified: 2026-07-16 (Asia/Shanghai)

## Application result

- Checkout creation sends only the server-selected Product mapping and configured success URL.
- The public/client contract cannot inject a coupon, discount, Product ID, amount, interval, or feature flag.
- V2 Annual copy and catalog logic do not intentionally stack ordinary coupons.
- Automated tests cover client-side Product/price bypass attempts.

## Provider-side status

**Blocked / not externally verified.** The automation environment could not access an authenticated Creem Test Dashboard session, so it could not read the scope of historical/founder/15% coupons or prove that no provider-managed promotion applies to V2 Annual Products.

Before Production annual activation, HumanOps must inspect every active Creem Live/Test promotion and confirm that V2 Annual Product IDs are excluded unless a promotion is explicitly approved. Record a sanitized screenshot or export without full Product IDs or secrets.
