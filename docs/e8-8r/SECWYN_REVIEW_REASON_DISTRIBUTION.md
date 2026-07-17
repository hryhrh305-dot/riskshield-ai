# Secwyn E8.8R Review Reason Distribution

## Evidence boundary

The repository does not contain the user's raw 2,000+ result dataset, and this task did not query Production or ingest customer email addresses. Therefore no fabricated claim is made about the real provider or REVIEW percentages.

The deterministic 100-row repository benchmark is not mailbox ground truth. Under the former override its 89 accepted rows produced 0 ALLOW / 59 REVIEW / 30 BLOCK. With the corrected action mapping it produces 59 ALLOW / 0 REVIEW / 30 BLOCK; the 30 hard blocks are unchanged. This demonstrates the override effect, not production accuracy.

## Repeatable sanitized analysis

Run:

```text
node scripts/e8-8r-review-distribution.mjs <sanitized-results.csv>
```

Required columns only:

```text
provider_group,decision,primary_reason_code,risk_score,mx_status,mailbox_status,catch_all_status,disposable,reserved_domain
```

Allowed provider groups include `gmail`, `outlook`, `yahoo`, `icloud`, `proton`, `google_workspace`, `microsoft_365`, `enterprise_mx`, `other`, and `unknown`. Do not include email, local part, name, user/customer/contact ID, Audit ID or any raw identifier. The parser rejects PII-shaped columns.

The output contains Decision counts, REVIEW reason counts, provider counts and per-provider Decision counts.
