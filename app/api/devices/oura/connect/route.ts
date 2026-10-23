import { NextResponse } from 'next/server'
import { getOuraAuthUrl } from '@/lib/devices/oura'
import { redirectWithState } from '@/lib/devices/oauth-state'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
  return redirectWithState('oura', getOuraAuthUrl)
}
