# Secwyn E8.8 Annual Checkout Gate

| Condition                                   | Starter/Growth V2 annual                                        | Scale V2 annual      |
| ------------------------------------------- | --------------------------------------------------------------- | -------------------- |
| V2 flag false                               | Legacy behavior only                                            | Legacy behavior only |
| V2 true, annual flag false                  | Display V2 annual terms as contact/not available for self-serve | Contact sales        |
| Both flags true, Product ID missing         | Fail closed; no checkout                                        | Contact sales        |
| Both flags true, Product ID mapped          | Self-serve allowed                                              | Contact sales        |
| Client supplies Product ID/generation/price | Ignore/reject; server derives mapping                           | Reject               |

Flags are server-only. Missing, blank, mixed-case or otherwise invalid values evaluate to false. No query string, request body or browser storage may override them.
