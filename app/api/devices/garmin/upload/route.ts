import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fillMetrics, parseGarminJson, type GarminImport } from '@/lib/devices/garmin-import'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const METRIC_KEYS = 'date, sleep_hours, sleep_deep_minutes, sleep_rem_minutes, sleep_light_minutes, sleep_score, hrv_avg, resting_hr, recovery_score, spo2_avg, strain_score, steps, active_calories'

// POST /api/devices/garmin/upload -- accepts one or more Garmin Connect JSON files
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const files = (await request.formData()).getAll('file').filter((f): f is File => f instanceof File)
  if (!files.length) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const merged: GarminImport = { activities: [], metrics: {}, unrecognized: 0 }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 20 MB` }, { status: 400 })
    }
    let json: unknown
    try { json = JSON.parse(await file.text()) } catch {
      return NextResponse.json({ error: `${file.name} is not valid JSON` }, { status: 400 })
    }
    const parsed = parseGarminJson(json)
    merged.activities.push(...parsed.activities)
    merged.unrecognized += parsed.unrecognized
    for (const [d, m] of Object.entries(parsed.metrics)) merged.metrics[d] = { ...merged.metrics[d], ...m }
  }

  // Dedupe activities within the upload; the DB constraint dedupes across uploads.
  const activityRows = [...new Map(merged.activities.map(a => [a.external_id, a])).values()]
    .map(a => ({ user_id: user.id, source: 'garmin', ...a }))
  if (activityRows.length) {
    const { error } = await supabase.from('activities').upsert(activityRows, { onConflict: 'user_id,source,external_id' })
    if (error) return NextResponse.json({ error: 'Saving activities failed' }, { status: 500 })
  }

  // Merge with existing Garmin rows so a sleep file doesn't wipe steps from a daily-summary file.
  const dates = Object.keys(merged.metrics)
  let metricRows: Record<string, unknown>[] = []
  if (dates.length) {
    const { data: existing } = await supabase.from('daily_metrics').select(METRIC_KEYS)
      .eq('user_id', user.id).eq('source', 'garmin').in('date', dates)
    const byDate = new Map((existing ?? []).map(r => [r.date as string, r]))
    metricRows = dates.map(date => {
      const prev = { ...(byDate.get(date) ?? {}) } as Record<string, unknown>
      delete prev.date
      return { user_id: user.id, date, source: 'garmin', ...fillMetrics(merged.metrics[date], prev) }
    })
    const { error } = await supabase.from('daily_metrics').upsert(metricRows, { onConflict: 'user_id,date,source' })
    if (error) return NextResponse.json({ error: 'Saving daily metrics failed' }, { status: 500 })
  }

  if (!activityRows.length && !metricRows.length) {
    return NextResponse.json({ error: 'No Garmin activities, sleep or daily data found in the file' }, { status: 400 })
  }

  // Service-role write: users can't update user_id/device_type columns directly (schema_v6).
  await createAdminClient().from('connected_devices').upsert({
    user_id: user.id,
    device_type: 'garmin',
    last_synced_at: new Date().toISOString(),
    meta: { status: 'ok', mode: 'upload' },
  }, { onConflict: 'user_id,device_type' })

  return NextResponse.json({ activities: activityRows.length, days: metricRows.length, skipped: merged.unrecognized })
}
