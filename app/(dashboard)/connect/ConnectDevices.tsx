'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ConnectedDevice } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Unlink, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const OAUTH_DEVICES = [
  {
    type: 'oura' as const,
    name: 'Oura Ring',
    icon: '💍',
    color: '#6366f1',
    description: 'Readiness, sleep stages, HRV, resting HR, steps, workouts',
    connectUrl: '/api/devices/oura/connect',
  },
  {
    type: 'whoop' as const,
    name: 'Whoop',
    icon: '⌚',
    color: '#f43f5e',
    description: 'Recovery, strain, sleep performance, HRV, SpO2, workouts',
    connectUrl: '/api/devices/whoop/connect',
  },
]

const MESSAGES: Record<string, string> = {
  'success=oura': 'Oura connected. Importing your last 90 days in the background.',
  'success=whoop': 'Whoop connected. Importing your last 90 days in the background.',
  'error=oura_denied': 'Oura connection was cancelled.',
  'error=whoop_denied': 'Whoop connection was cancelled.',
  'error=oura_state': 'Oura connection expired or was tampered with. Please try again.',
  'error=whoop_state': 'Whoop connection expired or was tampered with. Please try again.',
  'error=oura_failed': 'Could not connect Oura. Please try again.',
  'error=whoop_failed': 'Could not connect Whoop. Please try again.',
}

interface Props {
  connectedDevices: ConnectedDevice[]
}

export function ConnectDevices({ connectedDevices }: Props) {
  const params = useSearchParams()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [upload, setUpload] = useState({ loading: false, error: '', success: '' })

  const flashKey = ['success', 'error'].map(k => params.get(k) ? `${k}=${params.get(k)}` : '').find(Boolean)
  const flash = flashKey ? MESSAGES[flashKey] : null
  const flashIsError = flashKey?.startsWith('error')

  const device = (type: string) => connectedDevices.find(d => d.device_type === type)
  const hasOAuthDevice = OAUTH_DEVICES.some(d => device(d.type))

  async function disconnect(type: string) {
    setDisconnecting(type)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('connected_devices').delete().eq('user_id', user.id).eq('device_type', type)
    }
    window.location.assign('/connect')
  }

  async function syncNow() {
    setSyncing(true)
    setSyncMsg('')
    const res = await fetch('/api/devices/sync', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setSyncing(false)
    if (!res.ok) { setSyncMsg(data.error ?? 'Sync failed'); return }
    const failed = Object.entries(data.results ?? {}).filter(([, r]) => !(r as { ok: boolean }).ok).map(([k]) => k)
    setSyncMsg(failed.length ? `Sync failed for: ${failed.join(', ')}` : 'Up to date.')
    setTimeout(() => window.location.reload(), 1200)
  }

  async function uploadGarmin(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUpload({ loading: true, error: '', success: '' })
    const form = new FormData()
    Array.from(files).forEach(f => form.append('file', f))
    const res = await fetch('/api/devices/garmin/upload', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    e.target.value = ''
    if (!res.ok) {
      setUpload({ loading: false, error: data.error ?? 'Upload failed', success: '' })
    } else {
      setUpload({ loading: false, error: '', success: `Imported ${data.activities} activities and ${data.days} days of data.` })
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  const garmin = device('garmin')

  return (
    <div className="space-y-4">
      {flash && (
        <div className={cn('text-sm px-4 py-3 rounded-lg border',
          flashIsError ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300')}>
          {flash}
        </div>
      )}

      {hasOAuthDevice && (
        <div className="flex items-center justify-end gap-3">
          {syncMsg && <span className="text-xs text-white/50">{syncMsg}</span>}
          <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Sync now
          </Button>
        </div>
      )}

      {OAUTH_DEVICES.map(d => {
        const conn = device(d.type)
        const needsReauth = conn?.meta?.status === 'reauth_required'
        const hasError = conn?.meta?.status === 'error'
        return (
          <Card key={d.type} className={cn(conn && !needsReauth && 'border-emerald-500/30', needsReauth && 'border-amber-500/40')}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${d.color}20` }}>
                  {d.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{d.name}</h3>
                    {conn && !needsReauth && <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>}
                    {needsReauth && <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" />Reconnect needed</Badge>}
                  </div>
                  <p className="text-sm text-white/40 mb-3">{d.description}</p>

                  {conn && (
                    <p className="text-xs text-white/30 mb-3">
                      {conn.last_synced_at
                        ? `Last synced: ${new Date(conn.last_synced_at).toLocaleString()}`
                        : 'First import in progress…'}
                      {hasError && ' · last sync failed, will retry'}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {(!conn || needsReauth) && (
                      <Button size="sm" onClick={() => window.location.assign(d.connectUrl)}>
                        {needsReauth ? 'Reconnect' : 'Connect'} {d.name}
                      </Button>
                    )}
                    {conn && (
                      <Button variant="danger" size="sm" onClick={() => disconnect(d.type)} disabled={disconnecting === d.type}>
                        {disconnecting === d.type
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Unlink className="w-3 h-3 mr-1" />Disconnect</>}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Garmin: file import until an official API route is available */}
      <Card className={cn(garmin && 'border-emerald-500/30')}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: '#06b6d420' }}>
              🏃
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white">Garmin</h3>
                {garmin && <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Imported</Badge>}
              </div>
              <p className="text-sm text-white/40 mb-1">Activities, daily steps, resting HR and sleep.</p>
              <p className="text-xs text-white/30 mb-3">
                In Garmin Connect, go to Account → Data Management → Export Your Data. Unzip the archive and upload the
                JSON files from DI-Connect-Fitness, DI-Connect-Aggregator and DI-Connect-Wellness.
              </p>
              {garmin?.last_synced_at && (
                <p className="text-xs text-white/30 mb-3">Last import: {new Date(garmin.last_synced_at).toLocaleString()}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <label className={cn('inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md cursor-pointer',
                  'bg-white/10 hover:bg-white/15 text-white', upload.loading && 'opacity-50 pointer-events-none')}>
                  {upload.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {upload.loading ? 'Importing…' : 'Upload JSON files'}
                  <input type="file" accept=".json,application/json" multiple className="hidden" onChange={uploadGarmin} />
                </label>
                {garmin && (
                  <Button variant="danger" size="sm" onClick={() => disconnect('garmin')} disabled={disconnecting === 'garmin'}>
                    <Unlink className="w-3 h-3 mr-1" />Remove
                  </Button>
                )}
              </div>
              {upload.error && <p className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">{upload.error}</p>}
              {upload.success && <p className="mt-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">✓ {upload.success}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-lime-500/20">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-lime-500/10 flex items-center justify-center text-2xl flex-shrink-0">
            ✍️
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">Manual Entry</h3>
            <p className="text-sm text-white/40">
              No device? Log your workouts, mood, energy, and soreness manually from the dashboard every day.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
