import { NextRequest, NextResponse } from 'next/server'
import { getWhoopAuthUrl } from '@/lib/devices/whoop'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

  const state = Buffer.from(user.id).toString('base64')
  return NextResponse.redirect(getWhoopAuthUrl(state))
}
