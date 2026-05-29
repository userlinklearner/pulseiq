import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeOuraCode, fetchOuraData, mapOuraToMetrics } from '@/lib/devices/oura'
import { daysAgoISO, todayISO } from '@/lib/utils'

// GET /api/devices/oura -- OAuth callback
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?error=oura_denied`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

    const tokens = await exchangeOuraCode(code)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Save device
    await supabase.from('connected_devices').upsert({
      user_id:          user.id,
      device_type:      'oura',
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      token_expires_at: expiresAt,
      last_synced_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,device_type' })

    // Initial sync of last 30 days
    const ouraData = await fetchOuraData(tokens.access_token, daysAgoISO(30), todayISO())
    const rows = mapOuraToMetrics(ouraData.readiness, ouraData.sleep, user.id)

    if (rows.length) {
      await supabase.from('daily_metrics').upsert(rows, { onConflict: 'user_id,date,source' })
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?success=oura`)
  } catch (err) {
    console.error('Oura OAuth error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connect?error=oura_failed`)
  }
}
