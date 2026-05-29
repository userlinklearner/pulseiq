import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

// ── POST: accept an invite by token ───────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  // Find the pending relationship
  const { data: rel, error: findError } = await supabase
    .from('professional_relationships')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (findError || !rel) {
    return NextResponse.json(
      { error: 'Invitation not found or already used.' },
      { status: 404 }
    )
  }

  // The accepting user must be either the professional or the athlete
  if (rel.professional_id !== user.id && rel.athlete_id !== user.id) {
    return NextResponse.json(
      { error: 'This invitation was not sent to your account.' },
      { status: 403 }
    )
  }

  // Activate the relationship
  const { error: updateError } = await supabase
    .from('professional_relationships')
    .update({
      status:      'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', rel.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }

  // Return redirect target based on role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const redirect = profile?.role === 'athlete' ? '/settings/team' : '/patients'
  return NextResponse.json({ success: true, redirect })
}
