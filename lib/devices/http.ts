export class ProviderError extends Error {
  constructor(public provider: string, public status: number, message: string) {
    super(`${provider} ${status}: ${message}`)
  }
}

export async function fetchJson<T>(provider: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ProviderError(provider, res.status, body.slice(0, 300))
  }
  return res.json() as Promise<T>
}

export interface TokenSet {
  access_token: string
  refresh_token: string
  expires_in: number
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Local calendar date of a UTC timestamp given an offset like "-03:00".
export function localDate(utcIso: string, offset?: string | null): string {
  const t = new Date(utcIso).getTime()
  const m = offset?.match(/^([+-])(\d{2}):(\d{2})$/)
  const shiftMs = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0
  return new Date(t + shiftMs).toISOString().slice(0, 10)
}

// Every daily_metrics row carries the full column set so upserts never leave stale values.
export const EMPTY_METRICS = {
  sleep_hours: null as number | null,
  sleep_deep_minutes: null as number | null,
  sleep_rem_minutes: null as number | null,
  sleep_light_minutes: null as number | null,
  sleep_score: null as number | null,
  hrv_avg: null as number | null,
  resting_hr: null as number | null,
  recovery_score: null as number | null,
  spo2_avg: null as number | null,
  strain_score: null as number | null,
  steps: null as number | null,
  active_calories: null as number | null,
}
export type MetricValues = typeof EMPTY_METRICS

export interface ActivityRow {
  external_id: string
  started_at: string
  duration_secs: number | null
  activity_type: string | null
  distance_meters: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
}

export interface ProviderData {
  metrics: Record<string, MetricValues> // keyed by YYYY-MM-DD
  activities: ActivityRow[]
}

export const round = (n: unknown, digits = 0) =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null
