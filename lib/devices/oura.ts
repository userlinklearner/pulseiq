const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'
const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection'

export function getOuraAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/oura`,
    scope: 'daily heartrate workout session',
    state,
  })
  return `${OURA_AUTH_URL}?${params}`
}

export async function exchangeOuraCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/oura`,
    }),
  })
  if (!res.ok) throw new Error('Failed to exchange Oura code')
  return res.json()
}

export async function fetchOuraData(accessToken: string, startDate: string, endDate: string) {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = `?start_date=${startDate}&end_date=${endDate}`

  const [readiness, sleep, activity] = await Promise.all([
    fetch(`${OURA_API_BASE}/daily_readiness${params}`, { headers }).then(r => r.json()),
    fetch(`${OURA_API_BASE}/daily_sleep${params}`, { headers }).then(r => r.json()),
    fetch(`${OURA_API_BASE}/daily_activity${params}`, { headers }).then(r => r.json()),
  ])

  return { readiness: readiness.data ?? [], sleep: sleep.data ?? [], activity: activity.data ?? [] }
}

export function mapOuraToMetrics(readiness: Record<string, unknown>[], sleep: Record<string, unknown>[], userId: string) {
  const byDate: Record<string, Record<string, unknown>> = {}

  for (const r of readiness) {
    const d = r.day as string
    byDate[d] = { ...byDate[d], recovery_score: r.score, hrv_avg: (r as Record<string, unknown>).contributors ? null : null }
  }

  for (const s of sleep) {
    const d = s.day as string
    const contributors = (s.contributors ?? {}) as Record<string, number>
    byDate[d] = {
      ...byDate[d],
      sleep_hours: s.total_sleep_duration ? Number(s.total_sleep_duration) / 3600 : null,
      sleep_deep_minutes: s.deep_sleep_duration ? Math.round(Number(s.deep_sleep_duration) / 60) : null,
      sleep_rem_minutes: s.rem_sleep_duration ? Math.round(Number(s.rem_sleep_duration) / 60) : null,
      sleep_light_minutes: s.light_sleep_duration ? Math.round(Number(s.light_sleep_duration) / 60) : null,
      sleep_score: contributors.total_sleep ?? null,
      resting_hr: s.lowest_heart_rate ?? null,
      hrv_avg: s.average_hrv ?? null,
      spo2_avg: s.average_breath ? null : null,
    }
  }

  return Object.entries(byDate).map(([date, vals]) => ({
    user_id: userId,
    date,
    source: 'oura' as const,
    ...vals,
  }))
}
