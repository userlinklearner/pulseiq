'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ConnectedDevice } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Unlink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEVICES = [
  {
    type: 'oura' as const,
    name: 'Oura Ring',
    icon: '💍',
    color: '#6366f1',
    description: 'HRV, sleep stages, readiness score, temperature',
    connectUrl: '/api/devices/oura/connect',
    apiAvailable: true,
  },
  {
    type: 'whoop' as const,
    name: 'Whoop',
    icon: '⌚',
    color: '#f43f5e',
    description: 'Recovery, strain, sleep performance, HRV',
    connectUrl: '/api/devices/whoop/connect',
    apiAvailable: true,
  },
  {
    type: 'garmin' as const,
    name: 'Garmin',
    icon: '🏃',
    color: '#06b6d4',
    description: 'Activities, GPS tracks, health metrics, body battery',
    connectUrl: null,
    apiAvailable: false,
  },
]

interface GarminFormState {
  email: string
  password: string
  loading: boolean
  error: string
  success: string
}

interface Props {
  connectedDevices: ConnectedDevice[]
}

export function ConnectDevices({ connectedDevices }: Props) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [garmin, setGarmin] = useState<GarminFormState>({
    email: '', password: '', loading: false, error: '', success: '',
  })
  const [syncing, setSyncing] = useState(false)

  const isConnected = (type: string) =>
    connectedDevices.some(d => d.device_type === type)

  async function disconnect(type: string) {
    setDisconnecting(type)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('connected_devices').delete()
        .eq('user_id', user.id).eq('device_type', type)
    }
    window.location.reload()
  }

  async function connectGarmin(e: React.FormEvent) {
    e.preventDefault()
    setGarmin(g => ({ ...g, loading: true, error: '', success: '' }))
    const res  = await fetch('/api/devices/garmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: garmin.email, password: garmin.password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setGarmin(g => ({ ...g, loading: false, error: data.error ?? 'Connection failed' }))
    } else {
      setGarmin(g => ({ ...g, loading: false, success: `Synced ${data.metrics ?? 0} days and ${data.activities ?? 0} activities.` }))
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  async function resyncGarmin() {
    setSyncing(true)
    const res  = await fetch('/api/devices/garmin?days=30')
    const data = await res.json()
    setSyncing(false)
    alert(res.ok
      ? `Re-synced: ${data.metrics ?? 0} days, ${data.activities ?? 0} activities.`
      : data.error ?? 'Sync failed')
  }

  return (
    <div className="space-y-4">
      {DEVICES.map(device => {
        const connected = isConnected(device.type)
        const connDev = connectedDevices.find(d => d.device_type === device.type)

        return (
          <Card key={device.type} className={cn(connected && 'border-emerald-500/30')}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${device.color}20` }}
                >
                  {device.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{device.name}</h3>
                    {connected && <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>}
                  </div>
                  <p className="text-sm text-white/40 mb-3">{device.description}</p>

                  {connected && connDev?.last_synced_at && (
                    <p className="text-xs text-white/30 mb-3">
                      Last synced: {new Date(connDev.last_synced_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {device.apiAvailable ? (
                      connected ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => disconnect(device.type)}
                          disabled={disconnecting === device.type}
                        >
                          {disconnecting === device.type
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><Unlink className="w-3 h-3 mr-1" />Disconnect</>
                          }
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => window.location.href = device.connectUrl!}
                        >
                          Connect {device.name}
                        </Button>
                      )
                    ) : (
                      /* Garmin: credentials form */
                      connected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resyncGarmin}
                          disabled={syncing}
                        >
                          {syncing
                            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Syncing...</>
                            : '↻ Sync last 30 days'
                          }
                        </Button>
                      ) : (
                        <form onSubmit={connectGarmin} className="space-y-2 w-full max-w-sm">
                          <input
                            type="email"
                            placeholder="Garmin Connect email"
                            value={garmin.email}
                            onChange={e => setGarmin(g => ({ ...g, email: e.target.value }))}
                            required
                            className="w-full px-3 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={garmin.password}
                            onChange={e => setGarmin(g => ({ ...g, password: e.target.value }))}
                            required
                            className="w-full px-3 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={garmin.loading}
                            className="w-full"
                          >
                            {garmin.loading
                              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting & syncing...</>
                              : 'Connect Garmin'
                            }
                          </Button>
                          {garmin.error && (
                            <p className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                              {garmin.error}
                            </p>
                          )}
                          {garmin.success && (
                            <p className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                              ✓ {garmin.success}
                            </p>
                          )}
                        </form>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Manual entry notice */}
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
