import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncUserDevices } from '@/lib/devices/sync'

export const maxDuration = 300

// POST /api/devices/sync -- sync the signed-in user's connected wearables now
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await syncUserDevices(createAdminClient(), user.id)
  return NextResponse.json({ results })
}
