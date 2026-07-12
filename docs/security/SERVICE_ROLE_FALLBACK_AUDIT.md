# Service-role fallback audit

Status: local audit only. No secrets are included in this document.

## Classification

Classification: `CONFIRMED_SECRET_EXPOSURE` / **SECURITY ROTATION REQUIRED**. The local audit confirmed that a complete service-role credential was present in repository source and therefore may also exist in Git history. This document does not reproduce, hash, locate, or disclose the credential.

This finding does not change the local Phase B2 implementation scope. It does block every push and deployment until the credential rotation and a reviewed removal of the exposed fallback are complete.

## Bulk Run boundary

Bulk Run code uses `src/lib/supabase/admin.ts`, a server-only, fail-closed client. It has no literal fallback and does not return credentials to callers. Browser components and the Google Sheets script must use Secwyn API endpoints only; they must never import this module.

## Out-of-scope legacy paths

Existing fallback patterns outside Bulk Run are recorded as security debt for a separately authorized remediation/rotation task. This Phase B2 change does not refactor unrelated routes, alter production environment variables, or rotate secrets.

## Required before push or deploy

1. Rotate the affected credential in the correct Secwyn project and invalidate its prior value.
2. Remove or replace every confirmed literal fallback in a separately authorized security remediation.
3. Re-scan current files and history without displaying credentials.
4. Redeploy only after the rotation and environment update are verified.
