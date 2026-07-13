-- Cover the abuse_events API-key foreign key used by cleanup and investigations.
create index if not exists abuse_events_api_key_created_idx
  on public.abuse_events (api_key_id, created_at desc);
