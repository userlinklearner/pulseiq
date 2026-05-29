import { NextRequest, NextResponse } from 'next/server'
import { getOuraAuthUrl } from '@/lib/devices/oura'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

  const state = Buffer.from(user.id).toString('base64')
  return NextResponse.redirect(getOuraAuthUrl(state))
}
