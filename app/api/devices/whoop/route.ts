import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeWhoopCode, fetchWhoopData, mapWhoopToMetrics } from '@/lib/devices/whoop'
import { daysAgoISO, todayISO } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?error=whoop_denied`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

    const tokens = await exchangeWhoopCode(code)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await supabase.from('connected_devices').upsert({
      user_id:          user.id,
      device_type:      'whoop',
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      token_expires_at: expiresAt,
      last_synced_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,device_type' })

    // Initial 30-day sync
    const whoopData = await fetchWhoopData(tokens.access_token, daysAgoISO(30), todayISO())
    const rows = mapWhoopToMetrics(whoopData.recovery, whoopData.sleep, user.id)

    if (rows.length) {
      await supabase.from('daily_metrics').upsert(rows, { onConflict: 'user_id,date,source' })
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?success=whoop`)
  } catch (err) {
    console.error('Whoop OAuth error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?error=whoop_failed`)
  }
}
