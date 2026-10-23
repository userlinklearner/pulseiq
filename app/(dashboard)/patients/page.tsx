import { createClient } from '@/lib/supabase/server'
import { mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { redirect }      from 'next/navigation'
import { daysAgoISO }    from '@/lib/utils'
import { InviteModal }   from '@/components/professional/InviteModal'
import { CopyButton }    from '@/components/professional/CopyButton'
import { Badge }         from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  UserRound, Heart, TrendingUp, Gauge,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function PatientsPage() {
  const supabase = await createClient()
  const tz = await getTimeZone()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify this user is a professional
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, specialty')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'athlete') redirect('/dashboard')

  // All relationships for this professional
  const { data: rels } = await supabase
    .from('professional_relationships')
    .select('*')
    .eq('professional_id', user.id)
    .order('invited_at', { ascending: false })

  const relationships = rels ?? []

  // Fetch athlete profiles for all relationships
  const athleteIds = relationships.map(r => r.athlete_id)
  const { data: athleteProfiles } = athleteIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, primary_sport, birth_year, goal')
        .in('id', athleteIds)
    : { data: [] }

  const profileMap = Object.fromEntries(
    (athleteProfiles ?? []).map(p => [p.id, p])
  )

  // Latest metrics for active athletes
  const activeIds = relationships.filter(r => r.status === 'active').map(r => r.athlete_id)
  const { data: recentMetrics } = activeIds.length
    ? await supabase
        .from('daily_metrics')
        .select('user_id, date, source, hrv_avg, recovery_score, resting_hr, sleep_hours')
        .in('user_id', activeIds)
        .gte('date', daysAgoISO(7, tz))
        .order('date', { ascending: false })
    : { data: [] }

  // Group metrics: latest per athlete
  const latestMetrics: Record<string, {
    hrv_avg: number | null
    recovery_score: number | null
    resting_hr: number | null
    sleep_hours: number | null
    date: string
  }> = {}
  for (const m of mergeDailyMetrics(recentMetrics).reverse()) {
    if (!latestMetrics[m.user_id]) {
      latestMetrics[m.user_id] = m
    }
  }

  const active  = relationships.filter(r => r.status === 'active')
  const pending = relationships.filter(r => r.status === 'pending')

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {profile.role === 'doctor' ? 'My Patients' : 'My Athletes'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {active.length} active · {pending.length} pending invitation{pending.length !== 1 ? 's' : ''}
          </p>
        </div>
        <InviteModal role={profile.role as 'coach' | 'doctor'} />
      </div>

      {/* Active patients / athletes */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Active</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map(rel => {
              const athlete = profileMap[rel.athlete_id]
              const mx      = latestMetrics[rel.athlete_id]
              const age     = athlete?.birth_year
                ? new Date().getFullYear() - athlete.birth_year
                : null

              return (
                <Link key={rel.id} href={`/patients/${rel.athlete_id}`}>
                  <Card className="hover:border-teal-500/30 hover:bg-white/[0.07] transition-all cursor-pointer group">
                    <CardContent className="p-4 space-y-3">
                      {/* Name + sport */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                          <UserRound className="w-5 h-5 text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-teal-300 transition-colors">
                            {athlete?.display_name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-white/40">
                            {[athlete?.primary_sport, age ? `${age} yrs` : null]
                              .filter(Boolean).join(' · ') || 'No sport set'}
                          </p>
                        </div>
                        <Badge variant={rel.relationship_type === 'doctor' ? 'info' : 'success'}>
                          {rel.relationship_type}
                        </Badge>
                      </div>

                      {/* Latest metrics */}
                      {mx ? (
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                          <MetricMini
                            label="HRV"
                            value={mx.hrv_avg ? `${Math.round(mx.hrv_avg)}ms` : '—'}
                            icon={TrendingUp}
                            color="text-emerald-400"
                          />
                          <MetricMini
                            label="Recovery"
                            value={mx.recovery_score ? `${mx.recovery_score}%` : '—'}
                            icon={Gauge}
                            color="text-violet-400"
                          />
                          <MetricMini
                            label="RHR"
                            value={mx.resting_hr ? `${mx.resting_hr}bpm` : '—'}
                            icon={Heart}
                            color="text-rose-400"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-white/20 pt-1 border-t border-white/5">
                          No recent data
                        </p>
                      )}

                      {mx && (
                        <p className="text-[11px] text-white/20 -mt-1">
                          Last updated {mx.date}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Pending invitations */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Pending invitations</h2>
          <div className="space-y-2">
            {pending.map(rel => {
              const athlete = profileMap[rel.athlete_id]
              const token   = rel.invite_token
              const link    = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/accept?token=${token}`

              return (
                <div key={rel.id}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      {athlete?.display_name ?? 'Unknown'} — invitation pending
                    </p>
                    <p className="text-xs text-white/30 mt-0.5 truncate">
                      Share link: <span className="text-teal-400 font-mono text-[11px]">{link}</span>
                    </p>
                  </div>
                  <CopyButton value={link} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {relationships.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 flex items-center justify-center mx-auto">
              <UserRound className="w-7 h-7 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold">No patients yet</p>
              <p className="text-white/40 text-sm mt-1">
                Invite a patient or athlete by their PulseIQ email to get started.
              </p>
            </div>
            <InviteModal role={profile.role as 'coach' | 'doctor'} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Small helper ──────────────────────────────────────

function MetricMini({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className={cn('w-3 h-3', color)} />
      <p className="text-xs font-semibold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/30">{label}</p>
    </div>
  )
}
