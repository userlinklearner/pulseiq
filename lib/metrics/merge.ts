import type { Activity, DailyMetrics, DeviceType } from '@/types'

// daily_metrics stores one row per device per day. Every screen and the coach should see
// ONE row per day. Fields are merged in groups so related values come from the same device
// (e.g. deep and REM minutes from the same night's recording, never mixed across devices).

type MetricRow = Partial<DailyMetrics> & { date: string; source: string; user_id?: string }

const GROUPS: { fields: (keyof DailyMetrics)[]; anchor: keyof DailyMetrics; priority: DeviceType[] }[] = [
  {
    // Ring sensors are the most accurate sleep stagers of the three.
    fields: ['sleep_hours', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_score'],
    anchor: 'sleep_hours',
    priority: ['oura', 'whoop', 'garmin', 'manual'],
  },
  {
    fields: ['recovery_score', 'hrv_avg', 'resting_hr'],
    anchor: 'hrv_avg',
    priority: ['whoop', 'oura', 'garmin', 'manual'],
  },
  { fields: ['spo2_avg', 'spo2_low'], anchor: 'spo2_avg', priority: ['whoop', 'oura', 'garmin'] },
  { fields: ['strain_score'], anchor: 'strain_score', priority: ['whoop', 'garmin'] },
  { fields: ['stress_avg', 'body_battery_wake', 'body_battery_end'], anchor: 'body_battery_wake', priority: ['garmin', 'oura', 'whoop'] },
  // Wrist devices with GPS count steps better than rings or straps.
  { fields: ['steps'], anchor: 'steps', priority: ['garmin', 'oura', 'whoop', 'manual'] },
  { fields: ['active_calories'], anchor: 'active_calories', priority: ['garmin', 'whoop', 'oura', 'manual'] },
]

export type MergedMetrics = DailyMetrics & {
  sources: Partial<Record<keyof DailyMetrics, DeviceType>>
}

const has = (v: unknown) => v !== null && v !== undefined

function mergeDay(rows: MetricRow[]): MergedMetrics {
  const base = { ...rows[0] } as Record<string, unknown>
  const sources: MergedMetrics['sources'] = {}
  for (const g of GROUPS) {
    const ordered = [...rows].sort((a, b) => rank(g.priority, a.source) - rank(g.priority, b.source))
    // Prefer the device that recorded the group's anchor value; fall back to any value.
    const pick = ordered.find(r => has(r[g.anchor])) ?? ordered.find(r => g.fields.some(f => has(r[f])))
    for (const f of g.fields) {
      base[f] = pick?.[f] ?? null
      if (pick && has(pick[f])) sources[f] = pick.source as DeviceType
    }
  }
  const distinct = [...new Set(Object.values(sources))]
  base.source = distinct.length === 1 ? distinct[0] : (rows[0].source as DeviceType)
  return { ...(base as unknown as DailyMetrics), sources }
}

function rank(priority: DeviceType[], source: string) {
  const i = priority.indexOf(source as DeviceType)
  return i === -1 ? priority.length : i
}

// Returns one merged row per (user, date), sorted by date ascending.
export function mergeDailyMetrics(rows: MetricRow[] | null | undefined): MergedMetrics[] {
  const byKey = new Map<string, MetricRow[]>()
  for (const r of rows ?? []) {
    const key = `${r.user_id ?? ''}|${r.date}`
    const list = byKey.get(key)
    if (list) list.push(r); else byKey.set(key, [r])
  }
  return [...byKey.values()].map(mergeDay).sort((a, b) => a.date.localeCompare(b.date))
}

// The same workout recorded by two devices: starts within 10 minutes and similar duration.
// Keeps the record with the most detail (GPS distance, heart rate).
export function dedupeActivities<T extends Pick<Activity, 'started_at' | 'duration_secs' | 'distance_meters' | 'avg_hr'>>(list: T[]): T[] {
  const detail = (a: T) => (has(a.distance_meters) ? 2 : 0) + (has(a.avg_hr) ? 1 : 0)
  const kept: T[] = []
  for (const a of [...list].sort((x, y) => detail(y) - detail(x))) {
    const t = new Date(a.started_at).getTime()
    const dup = kept.some(k => {
      const sameStart = Math.abs(new Date(k.started_at).getTime() - t) <= 10 * 60_000
      const da = a.duration_secs ?? 0, dk = k.duration_secs ?? 0
      const similar = !da || !dk || Math.abs(da - dk) <= Math.max(da, dk) * 0.25
      return sameStart && similar
    })
    if (!dup) kept.push(a)
  }
  return kept.sort((x, y) => new Date(y.started_at).getTime() - new Date(x.started_at).getTime())
}
