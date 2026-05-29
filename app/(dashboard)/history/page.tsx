import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { HRVChart } from '@/components/dashboard/HRVChart'
import { SleepChart } from '@/components/dashboard/SleepChart'
import { RecoveryChart } from '@/components/dashboard/RecoveryChart'
import { daysAgoISO } from '@/lib/utils'
import { DailyMetrics } from '@/types'
import { TrendingChart } from './TrendingChart'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', daysAgoISO(90))
    .order('date', { ascending: true })

  const all: DailyMetrics[] = metrics ?? []

  // Compute stats
  const hrv    = all.filter(m => m.hrv_avg   !== null)
  const rhr    = all.filter(m => m.resting_hr !== null)
  const sleep  = all.filter(m => m.sleep_hours !== null)

  const avgHrv   = hrv.length   ? Math.round(hrv.reduce((s, m) => s + m.hrv_avg!, 0) / hrv.length)     : null
  const avgRhr   = rhr.length   ? Math.round(rhr.reduce((s, m) => s + m.resting_hr!, 0) / rhr.length)   : null
  const avgSleep = sleep.length ? (sleep.reduce((s, m) => s + m.sleep_hours!, 0) / sleep.length).toFixed(1) : null

  const bestHrv   = hrv.length   ? Math.max(...hrv.map(m => m.hrv_avg!))      : null
  const bestRhr   = rhr.length   ? Math.min(...rhr.map(m => m.resting_hr!))   : null
  const bestSleep = sleep.length ? Math.max(...sleep.map(m => m.sleep_hours!)) : null

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">History & Trends</h1>
        <p className="text-white/40 text-sm mt-1">Last 90 days across all connected devices</p>
      </div>

      {/* 90-day stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Avg HRV',       val: avgHrv   ? `${avgHrv} ms`   : '--', best: bestHrv   ? `Best: ${bestHrv} ms`        : '' },
          { label: 'Avg RHR',       val: avgRhr   ? `${avgRhr} bpm`  : '--', best: bestRhr   ? `Best: ${bestRhr} bpm`       : '' },
          { label: 'Avg Sleep',     val: avgSleep ? `${avgSleep} h`  : '--', best: bestSleep ? `Best: ${bestSleep?.toFixed(1)} h` : '' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardHeader><CardTitle>{stat.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{stat.val}</p>
              {stat.best && <p className="text-xs text-emerald-400 mt-1">{stat.best}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>HRV & Resting HR -- 90 days</CardTitle></CardHeader>
          <CardContent><HRVChart data={all} days={90} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sleep stages -- 30 days</CardTitle></CardHeader>
          <CardContent><SleepChart data={all} days={30} /></CardContent>
        </Card>
      </div>

      {all.some(m => m.recovery_score !== null) && (
        <Card>
          <CardHeader><CardTitle>Recovery scores -- 30 days</CardTitle></CardHeader>
          <CardContent><RecoveryChart data={all} days={30} /></CardContent>
        </Card>
      )}

      <TrendingChart data={all} />
    </div>
  )
}
