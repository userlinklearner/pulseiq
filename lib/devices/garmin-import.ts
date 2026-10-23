import { EMPTY_METRICS, round, type ActivityRow, type MetricValues } from './http'

// Parses JSON files from Garmin Connect. Supports:
//  - Activity lists from Garmin Connect (seconds / meters)
//  - Garmin "Export Your Data" archive files:
//      DI-Connect-Fitness/*_summarizedActivities.json  (ms / centimeters)
//      DI-Connect-Aggregator/UDSFile_*.json            (daily summaries)
//      DI-Connect-Wellness/*_sleepData.json            (sleep)
// Field coverage is best-effort; unknown shapes are ignored rather than guessed.

type Rec = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export interface GarminImport {
  activities: ActivityRow[]
  metrics: Record<string, Partial<MetricValues>>
  unrecognized: number
}

function flatten(json: unknown): Rec[] {
  if (Array.isArray(json)) {
    // Export archive wraps activities: [{ summarizedActivitiesExport: [...] }]
    if (json.length && (json[0] as Rec)?.summarizedActivitiesExport) {
      return json.flatMap(j => ((j as Rec).summarizedActivitiesExport as Rec[]) ?? [])
    }
    return json as Rec[]
  }
  return json && typeof json === 'object' ? [json as Rec] : []
}

function toIso(v: unknown): string | null {
  if (typeof v === 'number') return new Date(v).toISOString() // epoch ms in export archive
  if (typeof v === 'string') {
    const d = new Date(v.includes('T') || v.includes(' ') ? v.replace(' ', 'T') : v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

function parseActivity(a: Rec, fromArchive: boolean): ActivityRow | null {
  const started = toIso(a.startTimeGmt ?? a.startTimeLocal ?? a.beginTimestamp)
  const id = a.activityId ?? a.id
  if (!started || id === undefined || id === null) return null
  const duration = num(a.duration) ?? num(a.elapsedDuration)
  const distance = num(a.distance)
  const type = typeof a.activityType === 'string' ? a.activityType
    : ((a.activityType as Rec)?.typeKey as string | undefined) ?? null
  return {
    external_id: String(id),
    started_at: started,
    duration_secs: duration !== null ? Math.round(fromArchive ? duration / 1000 : duration) : null,
    activity_type: type,
    distance_meters: distance !== null ? round(fromArchive ? distance / 100 : distance, 2) : null,
    calories: round(num(a.calories)),
    avg_hr: round(num(a.averageHR) ?? num(a.avgHr)),
    max_hr: round(num(a.maxHR) ?? num(a.maxHr)),
  }
}

export function parseGarminJson(json: unknown): GarminImport {
  const out: GarminImport = { activities: [], metrics: {}, unrecognized: 0 }
  const fromArchive = Array.isArray(json) && !!(json[0] as Rec)?.summarizedActivitiesExport
  const day = (d: string) => (out.metrics[d] ??= {})

  for (const r of flatten(json)) {
    if (r.activityId !== undefined || r.beginTimestamp !== undefined) {
      const a = parseActivity(r, fromArchive)
      if (a) out.activities.push(a); else out.unrecognized++
    } else if (typeof r.calendarDate === 'string' && ('deepSleepSeconds' in r || 'sleepStartTimestampGMT' in r)) {
      const m = day(r.calendarDate)
      const secs = (k: string) => num(r[k])
      const asleep = (secs('deepSleepSeconds') ?? 0) + (secs('lightSleepSeconds') ?? 0) + (secs('remSleepSeconds') ?? 0)
      if (asleep > 0) m.sleep_hours = round(asleep / 3600, 2)
      if (secs('deepSleepSeconds') !== null) m.sleep_deep_minutes = Math.round(secs('deepSleepSeconds')! / 60)
      if (secs('lightSleepSeconds') !== null) m.sleep_light_minutes = Math.round(secs('lightSleepSeconds')! / 60)
      if (secs('remSleepSeconds') !== null) m.sleep_rem_minutes = Math.round(secs('remSleepSeconds')! / 60)
      const score = (r.sleepScores as Rec)?.overallScore ?? (r.sleepScores as Rec)?.overall
      if (num(score) !== null) m.sleep_score = round(num(score))
      else if (num((score as Rec)?.value) !== null) m.sleep_score = round(num((score as Rec).value))
    } else if (typeof r.calendarDate === 'string') {
      const m = day(r.calendarDate)
      if (num(r.totalSteps) !== null) m.steps = round(num(r.totalSteps))
      if (num(r.restingHeartRate) !== null) m.resting_hr = round(num(r.restingHeartRate))
      if (num(r.activeKilocalories) !== null) m.active_calories = round(num(r.activeKilocalories))
    } else {
      out.unrecognized++
    }
  }
  return out
}

export function fillMetrics(partial: Partial<MetricValues>, existing?: Partial<MetricValues> | null): MetricValues {
  return { ...EMPTY_METRICS, ...(existing ?? {}), ...partial }
}
