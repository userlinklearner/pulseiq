import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PYTHON  = String.raw`C:\Users\micha\garmin-givemydata\venv\Scripts\python.exe`
const SYNC_PY = String.raw`C:\Users\micha\garmin-givemydata\garmin_sync_supabase.py`

async function runSync(email: string, password: string, userId: string, days = 30) {
  const cmd = `"${PYTHON}" "${SYNC_PY}" --email "${email}" --password "${password}" --user-id "${userId}" --days ${days}`
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300_000 })
    // Last line of stdout is the JSON result
    const lines = stdout.trim().split('\n')
    const lastLine = lines[lines.length - 1]
    return JSON.parse(lastLine)
  } catch (err: any) {
    const output = err.stdout ?? ''
    const lines  = output.trim().split('\n')
    try { return JSON.parse(lines[lines.length - 1]) } catch {}
    return { ok: false, error: err.message ?? 'Sync failed' }
  }
}

// POST /api/devices/garmin — connect + initial sync
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  // Save device record (credentials stored in meta — encrypt in production)
  await supabase.from('connected_devices').upsert({
    user_id:        user.id,
    device_type:    'garmin',
    meta:           { email, password },  // TODO: encrypt at rest
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'user_id,device_type' })

  // Run initial sync (last 90 days)
  const result = await runSync(email, password, user.id, 90)

  if (!result.ok) {
    // Remove saved creds if login failed
    await supabase.from('connected_devices')
      .delete().eq('user_id', user.id).eq('device_type', 'garmin')
    return NextResponse.json({ error: result.error ?? 'Garmin login failed' }, { status: 400 })
  }

  // Update last_synced_at
  await supabase.from('connected_devices')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('device_type', 'garmin')

  return NextResponse.json(result)
}

// GET /api/devices/garmin/sync — re-sync with stored credentials
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: device } = await supabase
    .from('connected_devices')
    .select('meta')
    .eq('user_id', user.id)
    .eq('device_type', 'garmin')
    .single()

  if (!device?.meta?.email) {
    return NextResponse.json({ error: 'No Garmin account connected' }, { status: 404 })
  }

  const days = parseInt(new URL(request.url).searchParams.get('days') ?? '30')
  const result = await runSync(device.meta.email, device.meta.password, user.id, days)

  if (result.ok) {
    await supabase.from('connected_devices')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('device_type', 'garmin')
  }

  return NextResponse.json(result)
}
