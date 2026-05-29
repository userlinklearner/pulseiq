-- ============================================================
-- PulseIQ v5: Invite helper function
-- Run AFTER schema_v4
-- ============================================================

-- Look up a user's auth ID by email address.
-- Only callable with the service_role key (used by the API route).
create or replace function public.get_user_id_by_email(email_param text)
returns uuid language sql security definer as $$
  select id from auth.users where email = lower(trim(email_param)) limit 1;
$$;

-- Restrict to service_role only
revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant  execute on function public.get_user_id_by_email(text) to service_role;
