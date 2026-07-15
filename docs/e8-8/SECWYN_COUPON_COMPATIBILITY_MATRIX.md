# Secwyn E8.8 Coupon Compatibility Matrix

| Checkout                      | Ordinary coupon policy                          | Local enforcement                                                          |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| Legacy monthly/annual renewal | Preserve existing provider contract             | Do not add coupon metadata                                                 |
| V2 monthly                    | Allowed only after separate commercial approval | No client coupon input                                                     |
| V2 Starter/Growth annual      | No ordinary coupon stacking                     | No client coupon input; HumanOps must disable/verify provider-side coupons |
| V2 Scale annual               | No self-serve checkout                          | Blocked                                                                    |
| Business                      | Contract-specific                               | Manual                                                                     |

The current Checkout API sends no coupon code or discount identifier. Because provider-dashboard eligibility is external, the production cutover guide requires a manual coupon audit and a real checkout acceptance check before enabling annual self-serve.
