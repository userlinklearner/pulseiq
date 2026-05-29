import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/devices/garmin/upload -- accepts Garmin JSON export
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    let json: unknown

    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON file. Export from Garmin Connect as JSON.' }, { status: 400 })
    }

    let activitiesImported = 0
    let metricsImported    = 0

    // Handle Garmin Connect activity export format
    if (Array.isArray(json)) {
      const activityRows = (json as Record<string, unknown>[])
        .filter(a => a.startTimeLocal || a.beginTimestamp)
        .map((a: Record<string, unknown>) => ({
          user_id:         user.id,
          source:          'garmin',
          external_id:     String(a.activityId ?? a.id ?? Math.random()),
          started_at:      new Date(a.startTimeLocal as string || a.beginTimestamp as string).toISOString(),
          duration_secs:   a.duration ? Math.round(Number(a.duration)) : null,
          activity_type:   (a.activityType as Record<string,unknown>)?.typeKey as string || a.activityType as string || null,
          distance_meters: a.distance ? Number(a.distance) : null,
          calories:        a.calories ? Number(a.calories) : null,
          avg_hr:          a.averageHR ? Number(a.averageHR) : null,
          max_hr:          a.maxHR     ? Number(a.maxHR)     : null,
        }))

      if (activityRows.length) {
        await supabase.from('activities').upsert(activityRows, { onConflict: 'user_id,source,external_id' })
        activitiesImported = activityRows.length

        // Register garmin as connected device
        await supabase.from('connected_devices').upsert({
          user_id:        user.id,
          device_type:    'garmin',
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,device_type' })
      }
    }

    return NextResponse.json({ activities: activitiesImported, metrics: metricsImported })
  } catch (err) {
    console.error('Garmin upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
