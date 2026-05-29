import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Service-role client — bypasses RLS, used to look up users by email
function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── POST: create an invite ─────────────────────────────
// Body: { email, relationship_type, message?, invited_as? }
//   invited_as: 'professional' (default) | 'athlete'
//   When a professional sends it: professional_id = sender, athlete_id = found user
//   When an athlete sends it:     athlete_id = sender, professional_id = found user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, relationship_type, message, invited_as = 'professional' } = body

  if (!email || !relationship_type) {
    return NextResponse.json({ error: 'email and relationship_type required' }, { status: 400 })
  }
  if (!['coach', 'doctor'].includes(relationship_type)) {
    return NextResponse.json({ error: 'relationship_type must be coach or doctor' }, { status: 400 })
  }

  // Look up the target user by email
  const admin = getAdmin()
  const { data: targetId, error: lookupError } = await admin
    .rpc('get_user_id_by_email', { email_param: email })

  if (lookupError || !targetId) {
    return NextResponse.json(
      { error: `No PulseIQ account found for ${email}. Ask them to sign up first.` },
      { status: 404 }
    )
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
  }

  // Determine which side is which
  const professional_id = invited_as === 'athlete' ? targetId  : user.id
  const athlete_id      = invited_as === 'athlete' ? user.id   : targetId

  // Check for existing relationship
  const { data: existing } = await supabase
    .from('professional_relationships')
    .select('id, status')
    .eq('professional_id', professional_id)
    .eq('athlete_id', athlete_id)
    .single()

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ error: 'This relationship is already active' }, { status: 409 })
    }
    if (existing.status === 'pending') {
      const link = `${process.env.NEXT_PUBLIC_APP_URL}/accept?token=${(existing as Record<string, string>).invite_token}`
      return NextResponse.json({
        invite_url:   link,
        relationship: existing,
        reused:       true,
      })
    }
    // revoked — re-create by updating
    const { data: updated } = await admin
      .from('professional_relationships')
      .update({
        status:     'pending',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        accepted_at: null,
        revoked_at:  null,
        message,
      })
      .eq('id', existing.id)
      .select()
      .single()

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/accept?token=${(updated as Record<string, string>).invite_token}`
    return NextResponse.json({ invite_url: link, relationship: updated })
  }

  // Create new relationship
  const { data: rel, error: insertError } = await admin
    .from('professional_relationships')
    .insert({
      professional_id,
      athlete_id,
      relationship_type,
      status:     'pending',
      invited_by: user.id,
      message,
    })
    .select()
    .single()

  if (insertError) {
    console.error(insertError)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  const invite_url = `${process.env.NEXT_PUBLIC_APP_URL}/accept?token=${(rel as Record<string, string>).invite_token}`
  return NextResponse.json({ invite_url, relationship: rel }, { status: 201 })
}

// ── PATCH: update permissions ──────────────────────────
// Body: { relationship_id, can_view_metrics?, can_view_activities?, ... }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { relationship_id, ...perms } = body

  if (!relationship_id) {
    return NextResponse.json({ error: 'relationship_id required' }, { status: 400 })
  }

  const ALLOWED_KEYS = [
    'can_view_metrics', 'can_view_activities', 'can_view_exams',
    'can_view_events', 'can_view_manual', 'can_add_exams',
    'can_add_notes', 'can_create_plans',
  ]
  const updates: Record<string, boolean> = {}
  for (const key of ALLOWED_KEYS) {
    if (key in perms && typeof perms[key] === 'boolean') {
      updates[key] = perms[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid permission fields provided' }, { status: 400 })
  }

  // Only the athlete (data owner) can change permissions
  const { error } = await supabase
    .from('professional_relationships')
    .update(updates)
    .eq('id', relationship_id)
    .eq('athlete_id', user.id)   // RLS: only athlete can update

  if (error) {
    return NextResponse.json({ error: 'Update failed or not authorized' }, { status: 403 })
  }
  return NextResponse.json({ success: true })
}

// ── DELETE: revoke a relationship ──────────────────────
// Body: { relationship_id }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { relationship_id } = await req.json()
  if (!relationship_id) {
    return NextResponse.json({ error: 'relationship_id required' }, { status: 400 })
  }

  // Athlete can revoke; professional can also withdraw their own pending invite
  const { error } = await supabase
    .from('professional_relationships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', relationship_id)
    .or(`athlete_id.eq.${user.id},professional_id.eq.${user.id}`)

  if (error) {
    return NextResponse.json({ error: 'Revoke failed or not authorized' }, { status: 403 })
  }
  return NextResponse.json({ success: true })
}
