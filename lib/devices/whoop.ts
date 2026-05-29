const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1'

export function getWhoopAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/whoop`,
    scope: 'read:recovery read:sleep read:workout read:cycle offline',
    state,
  })
  return `${WHOOP_AUTH_URL}?${params}`
}

export async function exchangeWhoopCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.WHOOP_CLIENT_ID}:${process.env.WHOOP_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/devices/whoop`,
    }),
  })
  if (!res.ok) throw new Error('Failed to exchange Whoop code')
  return res.json()
}

export async function fetchWhoopData(accessToken: string, startDate: string, endDate: string) {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const start = new Date(startDate).toISOString()
  const end = new Date(endDate + 'T23:59:59').toISOString()
  const params = `?start=${start}&end=${end}&limit=25`

  const [cycles, recovery, sleep] = await Promise.all([
    fetch(`${WHOOP_API_BASE}/cycle${params}`, { headers }).then(r => r.json()),
    fetch(`${WHOOP_API_BASE}/recovery${params}`, { headers }).then(r => r.json()),
    fetch(`${WHOOP_API_BASE}/sleep${params}`, { headers }).then(r => r.json()),
  ])

  return {
    cycles: cycles.records ?? [],
    recovery: recovery.records ?? [],
    sleep: sleep.records ?? [],
  }
}

export function mapWhoopToMetrics(
  recovery: Record<string, unknown>[],
  sleep: Record<string, unknown>[],
  userId: string
) {
  const byDate: Record<string, Record<string, unknown>> = {}

  for (const r of recovery) {
    const score = r.score as Record<string, unknown>
    const date = (r.created_at as string).split('T')[0]
    byDate[date] = {
      ...byDate[date],
      recovery_score: score?.recovery_score ?? null,
      hrv_avg: score?.hrv_rmssd_milli ? Number(score.hrv_rmssd_milli) : null,
      resting_hr: score?.resting_heart_rate ?? null,
    }
  }

  for (const s of sleep) {
    const score = s.score as Record<string, unknown>
    const date = (s.start as string).split('T')[0]
    byDate[date] = {
      ...byDate[date],
      sleep_hours: score?.stage_summary
        ? ((score.stage_summary as Record<string, number>).total_in_bed_time_milli ?? 0) / 3600000
        : null,
      sleep_deep_minutes: score?.stage_summary
        ? Math.round(((score.stage_summary as Record<string, number>).total_slow_wave_sleep_time_milli ?? 0) / 60000)
        : null,
      sleep_rem_minutes: score?.stage_summary
        ? Math.round(((score.stage_summary as Record<string, number>).total_rem_sleep_time_milli ?? 0) / 60000)
        : null,
      sleep_score: score?.sleep_performance_percentage ?? null,
    }
  }

  return Object.entries(byDate).map(([date, vals]) => ({
    user_id: userId,
    date,
    source: 'whoop' as const,
    ...vals,
  }))
}
