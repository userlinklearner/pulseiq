import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ConnectDevices } from './ConnectDevices'

export default async function ConnectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: devices } = await supabase
    .from('connected_devices')
    .select('id, user_id, device_type, last_synced_at, meta, created_at')
    .eq('user_id', user.id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Connect Devices</h1>
        <p className="text-white/40 text-sm mt-1">
          Link your wearables. Oura and Whoop sync automatically every morning; Garmin imports from a file export.
        </p>
      </div>
      <Suspense>
        <ConnectDevices connectedDevices={devices ?? []} />
      </Suspense>
    </div>
  )
}
