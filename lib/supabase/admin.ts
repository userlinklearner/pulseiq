import { createClient } from '@supabase/supabase-js'

// Service-role client. Server-only: bypasses RLS. Use for token storage and background sync.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
