import {
  EMPTY_METRICS, fetchJson, localDate, round,
  type ActivityRow, type MetricValues, type ProviderData, type TokenSet,
} from './http'

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2'
const SCOPES = 'read:recovery read:cycles read:sleep read:workout offline'
const PAGE_LIMIT = 25 // WHOOP maximum

const redirectUri = () => `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/whoop`

export function getWhoopAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
  })
  return `${WHOOP_AUTH_URL}?${params}`
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  return fetchJson<TokenSet>('whoop', WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...body,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  })
}

export function exchangeWhoopCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
}

// Refresh rotates both tokens; the old access token stops working immediately.
export function refreshWhoopToken(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: 'offline' })
}

type Rec = Record<string, unknown>

async function fetchAll(token: string, path: string, startISO: string, endISO: string): Promise<Rec[]> {
  const out: Rec[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start: startISO, end: endISO, limit: String(PAGE_LIMIT) })
    if (nextToken) params.set('nextToken', nextToken)
    const page: { records?: Rec[]; next_token?: string | null } = await fetchJson(
      'whoop', `${WHOOP_API_BASE}/${path}?${params}`, { headers: { Authorization: `Bearer ${token}` } }
    )
    out.push(...(page.records ?? []))
    nextToken = page.next_token ?? null
  } while (nextToken)
  return out
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const scored = (r: Rec) => r.score_state === 'SCORED' && r.score && typeof r.score === 'object'

export async function fetchWhoop(token: string, startDate: string, endDate: string): Promise<ProviderData> {
  // Pull from the evening before startDate so the first night's sleep is included.
  const startISO = new Date(`${startDate}T00:00:00Z`).getTime() - 36 * 3600_000
  const endISO = new Date(`${endDate}T23:59:59Z`).getTime() + 14 * 3600_000
  const window = [new Date(startISO).toISOString(), new Date(endISO).toISOString()] as const

  const [cycles, recoveries, sleeps, workouts] = await Promise.all([
    fetchAll(token, 'cycle', ...window),
    fetchAll(token, 'recovery', ...window),
    fetchAll(token, 'activity/sleep', ...window),
    fetchAll(token, 'activity/workout', ...window),
  ])

  const inRange = (d: string) => d >= startDate && d <= endDate
  const metrics: Record<string, MetricValues> = {}
  const day = (d: string) => (metrics[d] ??= { ...EMPTY_METRICS })

  // Sleep and recovery belong to the day you wake up (local date of sleep end). Naps are skipped.
  const sleepDate: Record<string, string> = {}
  for (const s of sleeps) {
    if (s.nap === true || !scored(s) || typeof s.end !== 'string') continue
    const d = localDate(s.end, s.timezone_offset as string)
    sleepDate[String(s.id)] = d
    if (!inRange(d)) continue
    const score = s.score as Rec
    const st = (score.stage_summary ?? {}) as Record<string, number>
    const asleepMs = (st.total_in_bed_time_milli ?? 0) - (st.total_awake_time_milli ?? 0)
    const m = day(d)
    m.sleep_hours = asleepMs > 0 ? round(asleepMs / 3_600_000, 2) : null
    m.sleep_deep_minutes = num(st.total_slow_wave_sleep_time_milli) !== null ? Math.round(st.total_slow_wave_sleep_time_milli / 60_000) : null
    m.sleep_rem_minutes = num(st.total_rem_sleep_time_milli) !== null ? Math.round(st.total_rem_sleep_time_milli / 60_000) : null
    m.sleep_light_minutes = num(st.total_light_sleep_time_milli) !== null ? Math.round(st.total_light_sleep_time_milli / 60_000) : null
    m.sleep_score = round(num(score.sleep_performance_percentage))
  }

  const cycleDate: Record<string, string> = {}
  for (const r of recoveries) {
    const d = sleepDate[String(r.sleep_id)]
      ?? (typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : null)
    if (d && r.cycle_id !== undefined) cycleDate[String(r.cycle_id)] = d
    if (!scored(r)) continue
    if (!d || !inRange(d)) continue
    const score = r.score as Rec
    const m = day(d)
    m.recovery_score = round(num(score.recovery_score))
    m.hrv_avg = round(num(score.hrv_rmssd_milli), 1)
    m.resting_hr = round(num(score.resting_heart_rate))
    m.spo2_avg = round(num(score.spo2_percentage), 2)
  }

  // A cycle starts when you fall asleep, so date its strain by the day you woke up:
  // via its recovery's sleep, else 12h after the cycle start.
  for (const c of cycles) {
    if (!scored(c) || typeof c.start !== 'string') continue
    const d = cycleDate[String(c.id)]
      ?? localDate(new Date(new Date(c.start).getTime() + 12 * 3600_000).toISOString(), c.timezone_offset as string)
    if (!inRange(d)) continue
    const score = c.score as Rec
    const m = day(d)
    m.strain_score = round(num(score.strain), 2)
    const kj = num(score.kilojoule)
    m.active_calories = kj !== null ? Math.round(kj / 4.184) : null
  }

  const activities: ActivityRow[] = workouts
    .filter(w => scored(w) && typeof w.start === 'string')
    .filter(w => inRange(localDate(w.start as string, w.timezone_offset as string)))
    .map(w => {
      const score = w.score as Rec
      const start = new Date(w.start as string)
      const end = typeof w.end === 'string' ? new Date(w.end) : null
      const kj = num(score.kilojoule)
      return {
        external_id: String(w.id),
        started_at: start.toISOString(),
        duration_secs: end ? Math.round((end.getTime() - start.getTime()) / 1000) : null,
        activity_type: typeof w.sport_name === 'string' ? w.sport_name : null,
        distance_meters: round(num(score.distance_meter), 2),
        calories: kj !== null ? Math.round(kj / 4.184) : null,
        avg_hr: round(num(score.average_heart_rate)),
        max_hr: round(num(score.max_heart_rate)),
      }
    })

  return { metrics, activities }
}
