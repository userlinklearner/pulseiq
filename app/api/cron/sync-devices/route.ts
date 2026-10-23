import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAllDevices } from '@/lib/devices/sync'

export const maxDuration = 300

// Called by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const deadline = Date.now() + (maxDuration - 30) * 1000
  const summary = await syncAllDevices(createAdminClient(), deadline)
  console.log('[cron] device sync', summary)
  return NextResponse.json(summary)
}
