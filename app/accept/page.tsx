import { createClient }  from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { AcceptForm }     from './AcceptForm'
import { Zap, UserRound, Stethoscope, Dumbbell, ShieldCheck } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptPage({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorPage message="No invitation token found in this link." />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → send to login with return URL
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/accept?token=${token}`)}`)
  }

  // Look up the pending relationship
  const { data: rel } = await supabase
    .from('professional_relationships')
    .select('*')
    .eq('invite_token', token)
    .single()

  if (!rel) {
    return <ErrorPage message="This invitation link is invalid or has expired." />
  }

  if (rel.status === 'active') {
    return <ErrorPage message="This invitation has already been accepted." />
  }

  if (rel.status === 'revoked') {
    return <ErrorPage message="This invitation has been cancelled." />
  }

  // Fetch both sides' profiles
  const [proRes, athRes] = await Promise.all([
    supabase.from('profiles').select('display_name, role, specialty, credentials, bio').eq('id', rel.professional_id).single(),
    supabase.from('profiles').select('display_name, primary_sport').eq('id', rel.athlete_id).single(),
  ])

  const pro = proRes.data
  const ath = athRes.data

  // Verify current user is part of this relationship
  const isPartOfRel = user.id === rel.professional_id || user.id === rel.athlete_id
  if (!isPartOfRel) {
    return (
      <ErrorPage message="This invitation was sent to a different account. Please sign in with the correct account." />
    )
  }

  // Figure out who is accepting and what they're accepting
  const accepting = user.id === rel.professional_id ? 'professional' : 'athlete'

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Health data access request</h1>
        </div>

        {/* Invitation card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">

          {/* Parties */}
          <div className="flex items-center gap-4">
            {/* Professional */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
                {rel.relationship_type === 'doctor'
                  ? <Stethoscope className="w-6 h-6 text-teal-400" />
                  : <Dumbbell className="w-6 h-6 text-sky-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{pro?.display_name ?? 'Professional'}</p>
                <p className="text-xs text-white/40 capitalize">{rel.relationship_type}</p>
                {pro?.specialty && <p className="text-xs text-white/30">{pro.specialty}</p>}
                {pro?.credentials && <p className="text-xs text-teal-400/60">{pro.credentials}</p>}
              </div>
            </div>

            {/* Connector */}
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-6 h-6 text-violet-400" />
              <p className="text-[10px] text-white/30 text-center">wants to<br />access</p>
            </div>

            {/* Athlete */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                <UserRound className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{ath?.display_name ?? 'Athlete'}</p>
                <p className="text-xs text-white/40">Athlete</p>
                {ath?.primary_sport && <p className="text-xs text-white/30">{ath.primary_sport}</p>}
              </div>
            </div>
          </div>

          {/* What will be shared */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Default access granted</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'HRV & recovery scores',
                'Sleep data',
                'Training activities',
                'Medical exams',
                'Life events',
                'Wellness logs',
              ].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-teal-400 flex-shrink-0" />
                  <span className="text-xs text-white/50">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25 mt-2">
              The athlete controls exactly which data is shared and can revoke access at any time in Settings → Care Team.
            </p>
          </div>

          {/* Personal message from inviter */}
          {rel.message && (
            <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-xs text-white/30 mb-1">Message</p>
              <p className="text-sm text-white/70 italic">&ldquo;{rel.message}&rdquo;</p>
            </div>
          )}

          {/* Accept / decline buttons */}
          <AcceptForm token={token} accepting={accepting} />
        </div>
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid invitation</h1>
          <p className="text-white/40 text-sm">{message}</p>
        </div>
        <a
          href="/dashboard"
          className="inline-block text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          Go to dashboard →
        </a>
      </div>
    </div>
  )
}
