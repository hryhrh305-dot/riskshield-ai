# Secwyn E8.8 Creem Product Mapping Matrix

No real Product ID is stored in this document.

| Generation | Interval | Plan                 | Server environment key                | Checkout policy                 | Webhook policy                  |
| ---------- | -------- | -------------------- | ------------------------------------- | ------------------------------- | ------------------------------- |
| Legacy     | Monthly  | Starter/Growth/Scale | Existing `CREEM_*_PRODUCT_ID` aliases | Legacy public mode only         | Always recognize                |
| Legacy     | Annual   | Starter/Growth/Scale | Existing `CREEM_*_YEARLY_PRODUCT_ID`  | Legacy public mode only         | Always recognize                |
| V2         | Monthly  | Starter/Growth/Scale | `CREEM_*_MONTHLY_V2_PRODUCT_ID`       | V2 flag + mapping               | Always recognize configured IDs |
| V2         | Annual   | Starter/Growth       | `CREEM_*_ANNUAL_V2_PRODUCT_ID`        | V2 flag + annual flag + mapping | Always recognize configured IDs |
| V2         | Annual   | Scale                | `CREEM_SCALE_ANNUAL_V2_PRODUCT_ID`    | Always contact-led              | Recognize if configured         |

Duplicate IDs across different catalog entries are invalid. Unknown IDs grant no entitlement or credits.
