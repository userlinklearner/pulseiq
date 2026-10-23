-- v6: connector hardening
-- Run in the Supabase SQL editor after schema_v5.sql.

-- 1. Re-syncs and re-uploads upsert existing activities, which needs an UPDATE policy.
drop policy if exists "own data update" on public.activities;
create policy "own data update" on public.activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. OAuth tokens must never reach the browser. Tokens are read and written only by the
--    server with the service-role key, which bypasses these grants.
revoke select on public.connected_devices from anon, authenticated;
grant select (id, user_id, device_type, last_synced_at, meta, created_at)
  on public.connected_devices to authenticated;

revoke insert, update on public.connected_devices from anon, authenticated;
grant insert (user_id, device_type, last_synced_at, meta)
  on public.connected_devices to authenticated;
grant update (last_synced_at, meta)
  on public.connected_devices to authenticated;
-- delete stays allowed (users disconnect their own devices; RLS limits it to their rows)

-- 3. Garmin passwords were stored in meta by the old credential flow. Remove them.
update public.connected_devices
  set meta = coalesce(meta, '{}'::jsonb) - 'password' - 'email'
  where device_type = 'garmin';
