import { createClient } from '@/lib/supabase/server'
import { dedupeActivities, mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { redirect }     from 'next/navigation'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { SleepChart } from '@/components/dashboard/SleepChart'
import { HRVChart } from '@/components/dashboard/HRVChart'
import { RecoveryChart } from '@/components/dashboard/RecoveryChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { ManualEntryForm } from '@/components/dashboard/ManualEntryForm'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Moon, Zap, Activity, Gauge, TrendingUp } from 'lucide-react'
import { todayISO, daysAgoISO } from '@/lib/utils'
import { DailyMetrics, Activity as ActivityType } from '@/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const tz = await getTimeZone()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Professionals have their own home page
  const { data: proCheck } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (proCheck?.role === 'coach' || proCheck?.role === 'doctor') {
    redirect('/patients')
  }

  const today     = todayISO(tz)
  const days30ago = daysAgoISO(30, tz)
  const days14ago = daysAgoISO(14, tz)

  // Fetch all data in parallel
  const [metricsRes, activitiesRes, devicesRes, manualRes] = await Promise.all([
    supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', days30ago)
      .order('date', { ascending: true }),
    supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(20),
    supabase
      .from('connected_devices')
      .select('device_type, last_synced_at')
      .eq('user_id', user.id),
    supabase
      .from('manual_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single(),
  ])

  const metrics:    DailyMetrics[]  = mergeDailyMetrics(metricsRes.data)
  const activities: ActivityType[]  = dedupeActivities((activitiesRes.data ?? []) as ActivityType[])
  const devices    = devicesRes.data ?? []

  // No devices connected yet
  if (!devices.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
          <Zap className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect your first device</h2>
          <p className="text-white/40 max-w-sm">
            Link your Oura Ring, Whoop, or Garmin to start seeing your health data here.
          </p>
        </div>
        <Button asChild>
          <Link href="/connect">Connect a device</Link>
        </Button>
      </div>
    )
  }

  // Today's metrics (pick best available source)
  const todayMetrics = metrics.filter(m => m.date === today)
  const latest = (field: keyof DailyMetrics): number | null => {
    const recent = [...metrics].reverse()
    for (const m of recent) {
      const v = m[field]
      if (v !== null && v !== undefined) return v as number
    }
    return null
  }

  const sleep_hours   = latest('sleep_hours')
  const hrv           = latest('hrv_avg')
  const rhr           = latest('resting_hr')
  const recovery      = latest('recovery_score')
  const battery       = latest('body_battery_wake')
  const stress        = latest('stress_avg')

  // 14-day data for charts
  const chart14 = metrics.filter(m => m.date >= days14ago)

  // Wellness summary badge
  const wellnessBadge = () => {
    if (!recovery && !battery) return null
    const score = recovery ?? battery ?? 0
    if (score >= 70) return <Badge variant="success">Ready to train hard</Badge>
    if (score >= 40) return <Badge variant="warning">Moderate intensity</Badge>
    return <Badge variant="danger">Rest or easy only</Badge>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/40 text-sm">Today&apos;s snapshot</p>
            {wellnessBadge()}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {devices.map(d => (
            <Badge key={d.device_type} variant="info" className="capitalize">
              {d.device_type}
              {d.last_synced_at && (
                <span className="ml-1 opacity-50">
                  {new Date(d.last_synced_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="Sleep"
          value={sleep_hours?.toFixed(1) ?? null}
          unit="hrs"
          icon={Moon}
          iconColor="text-indigo-400"
          score={sleep_hours ? Math.min(100, (sleep_hours / 8) * 100) : null}
          subtitle="last night"
        />
        <MetricCard
          title="HRV"
          value={hrv ? Math.round(hrv) : null}
          unit="ms"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          subtitle="avg overnight"
        />
        <MetricCard
          title="Resting HR"
          value={rhr}
          unit="bpm"
          icon={Heart}
          iconColor="text-rose-400"
          score={rhr ? Math.max(0, 100 - ((rhr - 40) / 40) * 100) : null}
          subtitle="morning"
        />
        <MetricCard
          title="Recovery"
          value={recovery}
          unit="%"
          icon={Gauge}
          iconColor="text-violet-400"
          score={recovery}
          subtitle={todayMetrics[0]?.source ?? undefined}
        />
        <MetricCard
          title="Body Battery"
          value={battery}
          unit=""
          icon={Zap}
          iconColor="text-amber-400"
          score={battery}
          subtitle="at wake"
        />
        <MetricCard
          title="Stress"
          value={stress}
          unit=""
          icon={Activity}
          iconColor="text-red-400"
          score={stress ? 100 - stress : null}
          subtitle="avg yesterday"
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Sleep stages -- last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <SleepChart data={chart14} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>HRV & Resting HR -- last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <HRVChart data={metrics} />
          </CardContent>
        </Card>
      </div>

      {/* Recovery + manual entry */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {metrics.some(m => m.recovery_score !== null) ? (
            <Card>
              <CardHeader>
                <CardTitle>Recovery scores -- last 14 days</CardTitle>
              </CardHeader>
              <CardContent>
                <RecoveryChart data={chart14} />
              </CardContent>
            </Card>
          ) : (
            <ActivityFeed activities={activities} />
          )}
        </div>
        <ManualEntryForm date={today} />
      </div>

      {/* Activity feed */}
      {metrics.some(m => m.recovery_score !== null) && (
        <ActivityFeed activities={activities} />
      )}
    </div>
  )
}
