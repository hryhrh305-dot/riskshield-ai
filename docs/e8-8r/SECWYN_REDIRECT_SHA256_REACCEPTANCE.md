# Secwyn E8.8R Redirect SHA-256 Reacceptance

Status: implementation corrected previously; external Test Mode reacceptance pending Human Gate.

`src/lib/creem.ts::verifyCreemRedirectSignature` uses Creem's clarified SHA-256 construction: non-null return parameters in received order, excluding `signature`, followed by `salt=<API key>`, joined with `|`, then SHA-256 hex. It does not use HMAC for the redirect query. Webhook verification remains HMAC-SHA256 with the webhook secret and remains the authoritative entitlement writer.

After user Preview confirmation, reacceptance must prove:

- a fresh authenticated Test checkout returns a valid SHA-256 signature;
- invalid/tampered/missing signatures fail closed;
- the webhook activates entitlement exactly once;
- redirect processing never grants credits independently.

No payment was performed in E8.8R before the Human Gate.
