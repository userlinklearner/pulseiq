import { createClient }   from '@/lib/supabase/server'
import { dedupeActivities, mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { redirect }        from 'next/navigation'
import { daysAgoISO }      from '@/lib/utils'
import { PatientTabs }     from '@/components/professional/PatientTabs'
import { ProfessionalNotes } from '@/components/professional/ProfessionalNotes'
import { HRVChart }        from '@/components/dashboard/HRVChart'
import { SleepChart }      from '@/components/dashboard/SleepChart'
import { ActivityFeed }    from '@/components/dashboard/ActivityFeed'
import { MetricCard }      from '@/components/dashboard/MetricCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge }           from '@/components/ui/badge'
import {
  UserRound, Heart, TrendingUp, Gauge, Moon,
  FlaskConical, Calendar, ArrowLeft, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { DailyMetrics, Activity as ActivityType } from '@/types'
import { cn } from '@/lib/utils'

interface PageProps {
  params:       Promise<{ athleteId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function PatientDetailPage({ params, searchParams }: PageProps) {
  const { athleteId } = await params
  const { tab = 'overview' } = await searchParams

  const supabase = await createClient()
  const tz = await getTimeZone()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify active relationship and load permissions
  const { data: rel } = await supabase
    .from('professional_relationships')
    .select('*')
    .eq('professional_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .single()

  if (!rel) redirect('/patients')

  // Fetch athlete profile
  const { data: athlete } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', athleteId)
    .single()

  const age = athlete?.birth_year
    ? new Date().getFullYear() - athlete.birth_year
    : null

  // Parallel data fetches gated by permissions
  const [metricsRes, activitiesRes, examsRes, eventsRes, manualRes] = await Promise.all([
    rel.can_view_metrics
      ? supabase
          .from('daily_metrics')
          .select('*')
          .eq('user_id', athleteId)
          .gte('date', daysAgoISO(30, tz))
          .order('date', { ascending: true })
      : Promise.resolve({ data: [] }),

    rel.can_view_activities
      ? supabase
          .from('activities')
          .select('*')
          .eq('user_id', athleteId)
          .order('started_at', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] }),

    rel.can_view_exams
      ? supabase
          .from('medical_exams')
          .select(`
            id, title, exam_type, exam_date, provider, notes,
            biomarker_values(id, name, value, unit, flag, ref_low, ref_high)
          `)
          .eq('user_id', athleteId)
          .order('exam_date', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),

    rel.can_view_events
      ? supabase
          .from('life_events')
          .select('*')
          .eq('user_id', athleteId)
          .gte('date', daysAgoISO(60, tz))
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] }),

    rel.can_view_manual
      ? supabase
          .from('manual_entries')
          .select('*')
          .eq('user_id', athleteId)
          .gte('date', daysAgoISO(14, tz))
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const metrics:    DailyMetrics[]  = mergeDailyMetrics(metricsRes.data as DailyMetrics[] | null)
  const activities: ActivityType[]  = dedupeActivities((activitiesRes.data ?? []) as ActivityType[])
  const exams       = examsRes.data    ?? []
  const events      = eventsRes.data   ?? []
  const manual      = manualRes.data   ?? []

  // Latest values
  const latest = (field: keyof DailyMetrics): number | null => {
    for (let i = metrics.length - 1; i >= 0; i--) {
      const v = metrics[i][field]
      if (v !== null && v !== undefined) return v as number
    }
    return null
  }

  const tabs = [
    { key: 'overview', label: 'Overview',   show: true },
    { key: 'exams',    label: 'Exams',      show: rel.can_view_exams },
    { key: 'events',   label: 'Life Events',show: rel.can_view_events },
    { key: 'manual',   label: 'Wellness',   show: rel.can_view_manual },
    { key: 'notes',    label: 'Notes',      show: true },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + patient header */}
      <div className="space-y-4">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to patients
        </Link>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
            <UserRound className="w-7 h-7 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {athlete?.display_name ?? 'Unknown'}
              </h1>
              <Badge variant={rel.relationship_type === 'doctor' ? 'info' : 'success'}>
                {rel.relationship_type}
              </Badge>
            </div>
            <p className="text-white/40 text-sm mt-1">
              {[
                athlete?.primary_sport,
                age ? `${age} yrs` : null,
                athlete?.goal,
              ].filter(Boolean).join(' · ') || 'No profile data'}
            </p>
          </div>

          {/* Permissions summary */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'can_view_metrics',    label: 'Metrics' },
              { key: 'can_view_activities', label: 'Activities' },
              { key: 'can_view_exams',      label: 'Exams' },
              { key: 'can_view_events',     label: 'Events' },
              { key: 'can_add_notes',       label: 'Notes' },
            ].filter(p => (rel as Record<string, unknown>)[p.key]).map(p => (
              <span key={p.key}
                className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <PatientTabs tabs={tabs} activeTab={tab} />

      {/* ── Overview ─────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {rel.can_view_metrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  title="HRV"
                  value={latest('hrv_avg') ? Math.round(latest('hrv_avg')!) : null}
                  unit="ms"
                  icon={TrendingUp}
                  iconColor="text-emerald-400"
                  subtitle="latest"
                />
                <MetricCard
                  title="Sleep"
                  value={latest('sleep_hours')?.toFixed(1) ?? null}
                  unit="hrs"
                  icon={Moon}
                  iconColor="text-indigo-400"
                  score={latest('sleep_hours') ? Math.min(100, (latest('sleep_hours')! / 8) * 100) : null}
                  subtitle="latest"
                />
                <MetricCard
                  title="Recovery"
                  value={latest('recovery_score')}
                  unit="%"
                  icon={Gauge}
                  iconColor="text-violet-400"
                  score={latest('recovery_score')}
                  subtitle="latest"
                />
                <MetricCard
                  title="Resting HR"
                  value={latest('resting_hr')}
                  unit="bpm"
                  icon={Heart}
                  iconColor="text-rose-400"
                  score={latest('resting_hr') ? Math.max(0, 100 - ((latest('resting_hr')! - 40) / 40) * 100) : null}
                  subtitle="latest"
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>HRV & Resting HR — 30 days</CardTitle></CardHeader>
                  <CardContent><HRVChart data={metrics} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Sleep — 14 days</CardTitle></CardHeader>
                  <CardContent>
                    <SleepChart data={metrics.filter(m => m.date >= daysAgoISO(14, tz))} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {rel.can_view_activities && activities.length > 0 && (
            <ActivityFeed activities={activities} />
          )}

          {!rel.can_view_metrics && !rel.can_view_activities && (
            <LockedSection label="metrics and activities" />
          )}
        </div>
      )}

      {/* ── Exams ────────────────────────────────── */}
      {tab === 'exams' && rel.can_view_exams && (
        <div className="space-y-4">
          {exams.length === 0 ? (
            <EmptyState icon={FlaskConical} label="No medical exams recorded yet." />
          ) : exams.map((exam: Record<string, unknown>) => (
            <ExamCard key={exam.id as string} exam={exam} canAdd={rel.can_add_exams} athleteId={athleteId} />
          ))}
        </div>
      )}

      {/* ── Life events ──────────────────────────── */}
      {tab === 'events' && rel.can_view_events && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <EmptyState icon={Calendar} label="No life events in the last 60 days." />
          ) : events.map((ev: Record<string, unknown>) => (
            <div key={ev.id as string}
              className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="text-2xl flex-shrink-0">{getEventEmoji(ev.category as string)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{ev.title as string}</p>
                  <Badge variant="default" className="capitalize">{ev.category as string}</Badge>
                  {ev.severity != null && (
                    <Badge variant={severityVariant(ev.severity as number)}>
                      Severity {ev.severity as number}/5
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5">{ev.date as string}</p>
                {ev.notes != null && <p className="text-xs text-white/50 mt-1">{ev.notes as string}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Manual wellness ──────────────────────── */}
      {tab === 'manual' && rel.can_view_manual && (
        <div className="space-y-2">
          {manual.length === 0 ? (
            <EmptyState icon={TrendingUp} label="No wellness logs in the last 14 days." />
          ) : manual.map((m: Record<string, unknown>) => (
            <div key={m.id as string}
              className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 flex-wrap">
              <p className="text-sm font-medium text-white/60 font-mono">{m.date as string}</p>
              <div className="flex gap-3 flex-wrap">
                {(m.mood      != null) && <Chip label="Mood"     value={`${m.mood}/10`}     color="text-amber-400" />}
                {(m.energy    != null) && <Chip label="Energy"   value={`${m.energy}/10`}   color="text-emerald-400" />}
                {(m.soreness  != null) && <Chip label="Soreness" value={`${m.soreness}/10`} color="text-rose-400" />}
                {m.activity_type != null && (
                  <Chip label={m.activity_type as string}
                    value={`${m.duration_mins ?? '?'}min RPE${m.rpe ?? '?'}`}
                    color="text-violet-400" />
                )}
              </div>
              {m.notes != null && <p className="w-full text-xs text-white/40 italic">&ldquo;{m.notes as string}&rdquo;</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Notes ────────────────────────────────── */}
      {tab === 'notes' && (
        <ProfessionalNotes
          athleteId={athleteId}
          professionalId={user.id}
          canAdd={rel.can_add_notes}
        />
      )}
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="py-16 text-center text-white/30 text-sm flex flex-col items-center gap-3">
      <Icon className="w-8 h-8 opacity-30" />
      {label}
    </div>
  )
}

function LockedSection({ label }: { label: string }) {
  return (
    <div className="py-12 text-center text-white/30 text-sm flex flex-col items-center gap-2">
      <ShieldCheck className="w-7 h-7 opacity-30" />
      Access to {label} not granted for this relationship.
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-xs font-semibold', color)}>{value}</span>
      <span className="text-[10px] text-white/30">{label}</span>
    </div>
  )
}

function ExamCard({ exam, canAdd, athleteId }: {
  exam: Record<string, unknown>
  canAdd: boolean
  athleteId: string
}) {
  const biomarkers = (exam.biomarker_values as Record<string, unknown>[]) ?? []
  const flagged    = biomarkers.filter(b => b.flag && b.flag !== 'normal')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            {exam.title as string}
            <span className="ml-2 text-xs text-white/30 font-normal capitalize">
              {exam.exam_type as string}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {flagged.length > 0 && (
              <Badge variant="danger">{flagged.length} flag{flagged.length > 1 ? 's' : ''}</Badge>
            )}
            <span className="text-xs text-white/30">{exam.exam_date as string}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {biomarkers.map((b: Record<string, unknown>) => (
            <div key={b.id as string}
              className={cn(
                'p-3 rounded-lg border text-center',
                b.flag === 'critical' ? 'border-red-500/40 bg-red-500/10' :
                b.flag === 'high' || b.flag === 'low' ? 'border-amber-500/40 bg-amber-500/10' :
                'border-white/10 bg-white/5'
              )}>
              <p className="text-xs text-white/40 mb-1">{b.name as string}</p>
              <p className="text-sm font-bold text-white">
                {b.value as string} <span className="text-xs font-normal text-white/40">{b.unit as string}</span>
              </p>
              {b.flag != null && b.flag !== 'normal' && (
                <p className={cn('text-[10px] font-semibold mt-1 uppercase',
                  b.flag === 'critical' ? 'text-red-400' : 'text-amber-400')}>
                  {b.flag as string}
                </p>
              )}
            </div>
          ))}
        </div>
        {exam.notes != null && (
          <p className="text-xs text-white/40 mt-3 italic">{exam.notes as string}</p>
        )}
      </CardContent>
    </Card>
  )
}

function getEventEmoji(category: string): string {
  const map: Record<string, string> = {
    social: '🎉', travel: '✈️', illness: '🤒', injury: '🩹',
    stress: '😰', diet: '🍽️', sleep: '😴', other: '📌',
  }
  return map[category] ?? '📌'
}

function severityVariant(s: number): 'default' | 'warning' | 'danger' {
  if (s <= 2) return 'default'
  if (s <= 3) return 'warning'
  return 'danger'
}
