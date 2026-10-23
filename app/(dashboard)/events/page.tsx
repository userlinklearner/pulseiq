import { createClient } from '@/lib/supabase/server'
import { mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { EventsTimeline } from './EventsTimeline'
import { daysAgoISO } from '@/lib/utils'

export default async function EventsPage() {
  const supabase = await createClient()
  const tz = await getTimeZone()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [eventsRes, metricsRes] = await Promise.all([
    supabase
      .from('life_events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(50),
    supabase
      .from('daily_metrics')
      .select('date, source, hrv_avg, resting_hr, recovery_score, body_battery_wake')
      .eq('user_id', user.id)
      .gte('date', daysAgoISO(90, tz))
      .order('date', { ascending: true }),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Life Events</h1>
        <p className="text-white/40 text-sm mt-1">
          Log anything that can impact your health — parties, travel, illness, stress, alcohol, exams.
          The AI coach uses these to explain patterns in your data.
        </p>
      </div>
      <EventsTimeline
        events={eventsRes.data ?? []}
        metrics={mergeDailyMetrics(metricsRes.data)}
      />
    </div>
  )
}
