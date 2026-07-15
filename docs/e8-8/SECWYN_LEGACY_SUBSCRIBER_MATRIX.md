# Secwyn E8.8 Legacy Subscriber Matrix

| Legacy state                  | Renewal/term behavior                                              | Credits                                       | New checkout                    |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------- |
| Active monthly                | Preserve mapped product, price and monthly renewal                 | 500 / 2,500 / 15,000 monthly                  | Existing subscription only      |
| Monthly scheduled cancel      | Access through current paid period                                 | Current monthly grant                         | No Legacy repurchase in V2 mode |
| Active annual                 | Preserve annual price and annual term                              | Same monthly credits, up to 12 service months | Existing subscription only      |
| Annual scheduled cancel       | Continue monthly grants through paid-through date                  | Same Legacy allowance                         | No Legacy repurchase in V2 mode |
| Refunded/disputed             | Stop future grants; retain history; do not create negative balance | Unused transaction-linked credits revoked     | No                              |
| Expired/cancelled at term end | Entitlement ends                                                   | No future grant                               | Cannot buy old price in V2 mode |
| Portal access                 | Preserve existing customer portal                                  | Snapshot remains authoritative                | No catalog inference            |

Legacy recognition must remain available to Webhook even when public V2 pricing is enabled.
