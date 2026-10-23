import {
  addDaysISO, EMPTY_METRICS, fetchJson, round,
  type ActivityRow, type MetricValues, type ProviderData, type TokenSet,
} from './http'

const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'
const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection'
const SCOPES = 'personal daily heartrate workout session'

const redirectUri = () => `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/oura`

export function getOuraAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
  })
  return `${OURA_AUTH_URL}?${params}`
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  return fetchJson<TokenSet>('oura', OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...body,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  })
}

export function exchangeOuraCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
}

// Oura refresh tokens are single-use: always persist the new refresh_token.
export function refreshOuraToken(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

type Rec = Record<string, unknown>

async function fetchAll(token: string, path: string, startDate: string, endDate: string): Promise<Rec[]> {
  const out: Rec[] = []
  let nextToken: string | null = null
  do {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
    if (nextToken) params.set('next_token', nextToken)
    const page: { data?: Rec[]; next_token?: string | null } = await fetchJson(
      'oura', `${OURA_API_BASE}/${path}?${params}`, { headers: { Authorization: `Bearer ${token}` } }
    )
    out.push(...(page.data ?? []))
    nextToken = page.next_token ?? null
  } while (nextToken)
  return out
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export async function fetchOura(token: string, startDate: string, endDate: string): Promise<ProviderData> {
  // The detailed endpoints treat end_date as exclusive and don't line up exactly with `day`,
  // so pad the window by a day on each side and filter on `day` afterwards.
  const padStart = addDaysISO(startDate, -1)
  const padEnd = addDaysISO(endDate, 1)

  const [dailySleep, sleepPeriods, readiness, activity, workouts] = await Promise.all([
    fetchAll(token, 'daily_sleep', startDate, padEnd),
    fetchAll(token, 'sleep', padStart, padEnd),
    fetchAll(token, 'daily_readiness', startDate, padEnd),
    fetchAll(token, 'daily_activity', startDate, padEnd),
    fetchAll(token, 'workout', startDate, padEnd),
  ])

  const inRange = (d: unknown) => typeof d === 'string' && d >= startDate && d <= endDate
  const metrics: Record<string, MetricValues> = {}
  const day = (d: string) => (metrics[d] ??= { ...EMPTY_METRICS })

  for (const r of dailySleep) if (inRange(r.day)) day(r.day as string).sleep_score = num(r.score)
  for (const r of readiness) if (inRange(r.day)) day(r.day as string).recovery_score = num(r.score)
  for (const r of activity) {
    if (!inRange(r.day)) continue
    const m = day(r.day as string)
    m.steps = num(r.steps)
    m.active_calories = num(r.active_calories)
  }

  // Several sleep periods per day (naps, rest). Use the main one: long_sleep, else the longest.
  const mainSleep: Record<string, Rec> = {}
  for (const s of sleepPeriods) {
    const d = s.day as string
    if (!inRange(d) || s.type === 'rest') continue
    const cur = mainSleep[d]
    const better = !cur
      || (s.type === 'long_sleep' && cur.type !== 'long_sleep')
      || (s.type === cur.type && (num(s.total_sleep_duration) ?? 0) > (num(cur.total_sleep_duration) ?? 0))
    if (better) mainSleep[d] = s
  }
  for (const [d, s] of Object.entries(mainSleep)) {
    const m = day(d)
    const secs = (k: string) => num(s[k])
    m.sleep_hours = secs('total_sleep_duration') !== null ? round(secs('total_sleep_duration')! / 3600, 2) : null
    m.sleep_deep_minutes = secs('deep_sleep_duration') !== null ? Math.round(secs('deep_sleep_duration')! / 60) : null
    m.sleep_rem_minutes = secs('rem_sleep_duration') !== null ? Math.round(secs('rem_sleep_duration')! / 60) : null
    m.sleep_light_minutes = secs('light_sleep_duration') !== null ? Math.round(secs('light_sleep_duration')! / 60) : null
    m.hrv_avg = round(num(s.average_hrv), 1)
    m.resting_hr = round(num(s.lowest_heart_rate))
  }

  const activities: ActivityRow[] = workouts
    .filter(w => typeof w.start_datetime === 'string' && inRange((w.start_datetime as string).slice(0, 10)))
    .map(w => {
      const start = new Date(w.start_datetime as string)
      const end = typeof w.end_datetime === 'string' ? new Date(w.end_datetime) : null
      return {
        external_id: String(w.id),
        started_at: start.toISOString(),
        duration_secs: end ? Math.round((end.getTime() - start.getTime()) / 1000) : null,
        activity_type: typeof w.activity === 'string' ? w.activity : null,
        distance_meters: round(num(w.distance), 2),
        calories: round(num(w.calories)),
        avg_hr: null,
        max_hr: null,
      }
    })

  return { metrics, activities }
}
