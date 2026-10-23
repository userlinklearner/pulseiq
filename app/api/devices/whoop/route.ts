import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeWhoopCode } from '@/lib/devices/whoop'
import { clearState, verifyState } from '@/lib/devices/oauth-state'
import { saveTokens, syncUserDevices } from '@/lib/devices/sync'

export const maxDuration = 300

// GET /api/devices/whoop -- OAuth callback
export async function GET(request: NextRequest) {
  const app = process.env.NEXT_PUBLIC_APP_URL
  const back = (q: string) => clearState('whoop', NextResponse.redirect(`${app}/connect?${q}`))
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (searchParams.get('error') || !code) return back('error=whoop_denied')
  if (!verifyState('whoop', request)) return back('error=whoop_state')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${app}/login`)

  try {
    const admin = createAdminClient()
    await saveTokens(admin, user.id, 'whoop', await exchangeWhoopCode(code))
    // Backfill runs after the redirect so the user isn't left waiting on 90 days of history.
    after(() => syncUserDevices(admin, user.id).then(() => undefined))
    return back('success=whoop')
  } catch (err) {
    console.error('Whoop OAuth error:', err)
    return back('error=whoop_failed')
  }
}
