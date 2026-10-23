import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysISO, ProviderError, type ProviderData, type TokenSet } from './http'
import { fetchOura, refreshOuraToken } from './oura'
import { fetchWhoop, refreshWhoopToken } from './whoop'

export type OAuthProvider = 'oura' | 'whoop'

const PROVIDERS = {
  oura: { fetch: fetchOura, refresh: refreshOuraToken },
  whoop: { fetch: fetchWhoop, refresh: refreshWhoopToken },
} satisfies Record<OAuthProvider, {
  fetch: (token: string, start: string, end: string) => Promise<ProviderData>
  refresh: (refreshToken: string) => Promise<TokenSet>
}>

const INITIAL_DAYS = 90
const OVERLAP_DAYS = 3 // re-pull recent days: scores get revised after sync
const REFRESH_MARGIN_MS = 5 * 60_000

export interface DeviceRow {
  user_id: string
  device_type: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  last_synced_at: string | null
  meta: Record<string, unknown> | null
}

export interface SyncResult {
  ok: boolean
  days: number
  activities: number
  error?: string
  reauthRequired?: boolean
}

const todayUTC = () => new Date().toISOString().slice(0, 10)

export function tokenFields(t: TokenSet) {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }
}

// Saves tokens from the OAuth callback. Must use the service-role client: tokens are not readable by users.
export async function saveTokens(admin: SupabaseClient, userId: string, provider: OAuthProvider, t: TokenSet) {
  const { error } = await admin.from('connected_devices').upsert({
    user_id: userId,
    device_type: provider,
    ...tokenFields(t),
    last_synced_at: null,
    meta: { status: 'ok' },
  }, { onConflict: 'user_id,device_type' })
  if (error) throw new Error(`Saving ${provider} tokens failed: ${error.message}`)
}

async function markStatus(admin: SupabaseClient, d: DeviceRow, status: string, error?: string) {
  await admin.from('connected_devices')
    .update({ meta: { ...(d.meta ?? {}), status, last_error: error ?? null, last_error_at: error ? new Date().toISOString() : null } })
    .eq('user_id', d.user_id).eq('device_type', d.device_type)
}

export async function syncDevice(admin: SupabaseClient, device: DeviceRow): Promise<SyncResult> {
  const provider = PROVIDERS[device.device_type as OAuthProvider]
  if (!provider) return { ok: false, days: 0, activities: 0, error: 'Not an OAuth device' }
  if (!device.access_token) return { ok: false, days: 0, activities: 0, error: 'No token', reauthRequired: true }

  let accessToken = device.access_token
  try {
    const expires = device.token_expires_at ? new Date(device.token_expires_at).getTime() : 0
    if (expires - Date.now() < REFRESH_MARGIN_MS) {
      if (!device.refresh_token) throw new ProviderError(device.device_type, 401, 'No refresh token')
      const t = await provider.refresh(device.refresh_token)
      const { error } = await admin.from('connected_devices').update(tokenFields(t))
        .eq('user_id', device.user_id).eq('device_type', device.device_type)
      if (error) throw new Error(`Saving refreshed token failed: ${error.message}`)
      accessToken = t.access_token
    }

    const end = todayUTC()
    const start = device.last_synced_at
      ? addDaysISO(device.last_synced_at.slice(0, 10), -OVERLAP_DAYS)
      : addDaysISO(end, -INITIAL_DAYS)

    const data = await provider.fetch(accessToken, start, end)

    const metricRows = Object.entries(data.metrics).map(([date, values]) => ({
      user_id: device.user_id, date, source: device.device_type, ...values,
    }))
    if (metricRows.length) {
      const { error } = await admin.from('daily_metrics').upsert(metricRows, { onConflict: 'user_id,date,source' })
      if (error) throw new Error(`Saving metrics failed: ${error.message}`)
    }

    const activityRows = data.activities.map(a => ({ user_id: device.user_id, source: device.device_type, ...a }))
    if (activityRows.length) {
      const { error } = await admin.from('activities').upsert(activityRows, { onConflict: 'user_id,source,external_id' })
      if (error) throw new Error(`Saving activities failed: ${error.message}`)
    }

    await admin.from('connected_devices')
      .update({ last_synced_at: new Date().toISOString(), meta: { ...(device.meta ?? {}), status: 'ok', last_error: null, last_error_at: null } })
      .eq('user_id', device.user_id).eq('device_type', device.device_type)

    return { ok: true, days: metricRows.length, activities: activityRows.length }
  } catch (err) {
    const reauth = err instanceof ProviderError && (err.status === 400 || err.status === 401)
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sync] ${device.device_type} for ${device.user_id}:`, message)
    await markStatus(admin, device, reauth ? 'reauth_required' : 'error', message)
    return { ok: false, days: 0, activities: 0, error: message, reauthRequired: reauth }
  }
}

const DEVICE_COLUMNS = 'user_id, device_type, access_token, refresh_token, token_expires_at, last_synced_at, meta'

export async function syncUserDevices(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from('connected_devices')
    .select(DEVICE_COLUMNS).eq('user_id', userId).in('device_type', Object.keys(PROVIDERS))
  if (error) throw error
  const results: Record<string, SyncResult> = {}
  for (const d of (data ?? []) as DeviceRow[]) results[d.device_type] = await syncDevice(admin, d)
  return results
}

export async function syncAllDevices(admin: SupabaseClient, deadlineMs: number) {
  const { data, error } = await admin.from('connected_devices')
    .select(DEVICE_COLUMNS).in('device_type', Object.keys(PROVIDERS))
    .order('last_synced_at', { ascending: true, nullsFirst: true })
  if (error) throw error
  let ok = 0, failed = 0, skipped = 0
  for (const d of (data ?? []) as DeviceRow[]) {
    if (d.meta?.status === 'reauth_required') { skipped++; continue }
    if (Date.now() > deadlineMs) { skipped++; continue } // oldest-first: the rest go next run
    const r = await syncDevice(admin, d)
    if (r.ok) ok++; else failed++
  }
  return { ok, failed, skipped }
}
