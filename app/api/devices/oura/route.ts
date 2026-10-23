import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeOuraCode } from '@/lib/devices/oura'
import { clearState, verifyState } from '@/lib/devices/oauth-state'
import { saveTokens, syncUserDevices } from '@/lib/devices/sync'

export const maxDuration = 300

// GET /api/devices/oura -- OAuth callback
export async function GET(request: NextRequest) {
  const app = process.env.NEXT_PUBLIC_APP_URL
  const back = (q: string) => clearState('oura', NextResponse.redirect(`${app}/connect?${q}`))
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (searchParams.get('error') || !code) return back('error=oura_denied')
  if (!verifyState('oura', request)) return back('error=oura_state')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${app}/login`)

  try {
    const admin = createAdminClient()
    await saveTokens(admin, user.id, 'oura', await exchangeOuraCode(code))
    // Backfill runs after the redirect so the user isn't left waiting on 90 days of history.
    after(() => syncUserDevices(admin, user.id).then(() => undefined))
    return back('success=oura')
  } catch (err) {
    console.error('Oura OAuth error:', err)
    return back('error=oura_failed')
  }
}
