# Bulk Run Migration Review

Status: local-only review. This P0 migration is not Task 2D and has not been executed.

## Schema and retention

`bulk_runs` stores one 7-day, owner-scoped run. `bulk_run_chunks` stores at most 50 normalized input emails and one bounded result payload per chunk. It never stores all 5,000 rich results in a single row. Run statuses are `pending`, `processing`, `partial`, `completed`, `cancelled`, `expired`, and `failed_terminal`; chunk statuses are `pending`, `processing`, `completed`, `failed_retryable`, `failed_terminal`, `cancelled`, and `expired`.

Inputs and result payloads are retained until `expires_at` (seven days). `expire_stale_bulk_runs` supports future authorized cron cleanup; this migration deliberately does not configure a cron job.

## Transaction and credits

`create_bulk_run` is a single `SECURITY DEFINER` transaction: it validates source, fingerprint, chunk shape/indexes and limits, resolves same-key replay/conflict, checks an active duplicate, locks and decrements `profiles.credits_remaining`, inserts the run, inserts all chunks, and returns lightweight metadata. Any failure rolls back the reserve and every insert.

The full deduplicated run is reserved once. Chunks do not charge credits. Cached results remain chargeable. Cancellation/expiry returns only unfinished contact credits, is idempotent, and cannot refund completed runs or completed chunks. The profile update predicate prevents a negative balance under concurrent requests. A chunk claim receives a fresh lease token; finalize/fail require that exact unexpired token, so a superseded worker cannot overwrite a later claim.

## Replay, ownership, and security

`unique(user_id, idempotency_key)` makes same key + same fingerprint replay safe and same key + different input a conflict. The active partial unique fingerprint index returns an active duplicate run; a terminal run can use a new key. Chunk `(run_id, chunk_index)` is unique and each chunk persists an input fingerprint.

RLS allows authenticated owners to read their own records only. There are no client write policies. RPCs use `SECURITY DEFINER` with `search_path = ''`, are revoked from public/anon/authenticated, and are granted only to `service_role`. Browser and Apps Script callers never provide a trusted `user_id`; server routes resolve it from a session or validated `x-api-key` owner.

## Deployment order and preflight

1. Confirm the linked project is Secwyn and back up/record the current schema.
2. Review `profiles(id, credits_remaining)` and ensure `credits_remaining` is non-negative.
3. Apply this migration in an approved maintenance window.
4. Inspect function grants, RLS, indexes, and a zero-credit/no-write test in a non-production environment.
5. Deploy the application routes only after the migration is verified.

```sql
select current_database(), to_regclass('public.profiles');
select id, credits_remaining from public.profiles order by created_at desc limit 3;
select routine_name from information_schema.routines where routine_schema = 'public' and routine_name like '%bulk_run%';
select grantee, routine_name from information_schema.role_routine_grants where specific_schema = 'public' and routine_name like '%bulk_run%';
```

## Postflight and rollback

Verify RLS, function grants, a same-key replay, an active duplicate, insufficient credits, cancellation, and expiry in a safe environment before any real 4,004/5,000 run. Do not automatically drop populated tables. Roll back by disabling new routes first, reconciling unfinished run credits with a reviewed transaction, then separately revoking functions/policies and removing empty tables only with explicit production approval.

No existing data, legacy API route, scoring boundary, SEO/canonical setting, Creem flow, referral flow, or Task 2D ledger is changed by this migration.
