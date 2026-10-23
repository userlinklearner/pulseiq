import { createClient } from '@/lib/supabase/server'
import { dedupeActivities, mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { daysAgoISO, todayISO, formatDuration, formatDistance } from '@/lib/utils'

// Builds the full context payload that the AI coach receives
export async function buildCoachContext(userId: string): Promise<string> {
  const supabase = await createClient()
  const tz = await getTimeZone()
  const today    = todayISO(tz)
  const days30   = daysAgoISO(30, tz)
  const days7    = daysAgoISO(7, tz)

  const [profileRes, metricsRes, activitiesRes, manualRes, planRes, communityRes, eventsRes, examsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('daily_metrics').select('*').eq('user_id', userId).gte('date', days30).order('date'),
    supabase.from('activities').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(20),
    supabase.from('manual_entries').select('*').eq('user_id', userId).gte('date', days7).order('date'),
    supabase.from('training_plans').select('*').eq('user_id', userId).eq('status', 'active').limit(1).single(),
    supabase.from('community_profiles').select('*').limit(50),
    supabase.from('life_events').select('*').eq('user_id', userId).gte('date', daysAgoISO(60, tz)).order('date', { ascending: false }),
    supabase.from('biomarker_values').select('*, medical_exams(exam_date, title, exam_type)').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
  ])

  const profile    = profileRes.data
  const metrics    = mergeDailyMetrics(metricsRes.data)
  const activities = dedupeActivities(activitiesRes.data ?? [])
  const manual     = manualRes.data     ?? []
  const plan       = planRes.data
  const community  = communityRes.data  ?? []
  const events     = eventsRes.data     ?? []
  const biomarkers = examsRes.data      ?? []

  // Latest metrics
  const latest = (field: string) => {
    for (let i = metrics.length - 1; i >= 0; i--) {
      const v = (metrics[i] as unknown as Record<string, unknown>)[field]
      if (v !== null && v !== undefined) return v
    }
    return null
  }

  // 7-day averages
  const recent7 = metrics.filter(m => m.date >= days7)
  const avg7 = (field: string) => {
    const vals = recent7.map(m => (m as unknown as Record<string, unknown>)[field] as number).filter(v => v != null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A'
  }

  // 30-day averages
  const avg30 = (field: string) => {
    const vals = metrics.map(m => (m as unknown as Record<string, unknown>)[field] as number).filter(v => v != null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A'
  }

  // Find similar community profiles
  const ageGroup = profile?.birth_year
    ? (() => {
        const age = new Date().getFullYear() - profile.birth_year
        if (age < 25) return '20-25'
        if (age < 30) return '25-30'
        if (age < 35) return '30-35'
        if (age < 40) return '35-40'
        return '40+'
      })()
    : null

  const similar = community.filter(c =>
    (!ageGroup || c.age_group === ageGroup) ||
    (profile?.primary_sport && c.sport_focus === profile.primary_sport?.toLowerCase())
  ).slice(0, 5)

  // Build context string
  const lines: string[] = [
    '=== USER PROFILE ===',
    `Name: ${profile?.display_name ?? 'Unknown'}`,
    `Age group: ${ageGroup ?? 'Unknown'}`,
    `Primary sport: ${profile?.primary_sport ?? 'Not specified'}`,
    `Goal: ${profile?.goal ?? 'Not specified'}`,
    `Today's date: ${today}`,
    '',
    '=== CURRENT HEALTH STATUS (last 7 days avg) ===',
    `HRV: ${avg7('hrv_avg')} ms (30d avg: ${avg30('hrv_avg')} ms)`,
    `Resting HR: ${avg7('resting_hr')} bpm (30d avg: ${avg30('resting_hr')} bpm)`,
    `Sleep: ${avg7('sleep_hours')} hours (30d avg: ${avg30('sleep_hours')} hours)`,
    `Recovery score: ${avg7('recovery_score')} / 100`,
    `Body battery at wake: ${avg7('body_battery_wake')} / 100`,
    `Stress: ${avg7('stress_avg')} / 100`,
    '',
    `Latest HRV: ${latest('hrv_avg') ?? 'N/A'} ms`,
    `Latest RHR: ${latest('resting_hr') ?? 'N/A'} bpm`,
    `Latest body battery: ${latest('body_battery_wake') ?? 'N/A'}`,
    '',
    '=== RECENT TRAINING (last 20 activities) ===',
  ]

  for (const a of activities.slice(0, 10)) {
    const date = new Date(a.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const parts = [
      date,
      a.activity_type ?? 'Workout',
      a.duration_secs ? formatDuration(a.duration_secs) : null,
      a.distance_meters ? formatDistance(a.distance_meters) : null,
      a.avg_hr ? `avg ${a.avg_hr}bpm` : null,
    ].filter(Boolean)
    lines.push(`  • ${parts.join(' | ')}`)
  }

  if (manual.length) {
    lines.push('')
    lines.push('=== SUBJECTIVE WELLNESS (last 7 days) ===')
    for (const m of manual) {
      const parts = [
        m.date,
        m.mood      ? `mood ${m.mood}/10`       : null,
        m.energy    ? `energy ${m.energy}/10`   : null,
        m.soreness  ? `soreness ${m.soreness}/10` : null,
        m.activity_type ? `${m.activity_type} ${m.duration_mins ?? '?'}min RPE${m.rpe ?? '?'}` : null,
        m.notes     ? `"${m.notes}"` : null,
      ].filter(Boolean)
      lines.push(`  • ${parts.join(' | ')}`)
    }
  }

  if (plan) {
    lines.push('')
    lines.push('=== ACTIVE TRAINING PLAN ===')
    lines.push(`Title: ${plan.title}`)
    lines.push(`Goal: ${plan.goal ?? 'N/A'}`)
    lines.push(`Duration: ${plan.duration_weeks} weeks, started ${plan.start_date}`)
    lines.push(`Status: ${plan.status}`)
  }

  if (events.length) {
    lines.push('')
    lines.push('=== LIFE EVENTS (last 60 days) ===')
    for (const e of events) {
      const impacts = (e.impacts as string[]).join(', ')
      lines.push(`  • ${e.date}: ${e.title} [${e.category}]${impacts ? ` — impacts: ${impacts}` : ''}${e.severity ? ` (severity ${e.severity}/5)` : ''}${e.notes ? ` — "${e.notes}"` : ''}`)
    }
    lines.push('NOTE: Cross-reference life events with HRV dips and recovery scores when coaching.')
  }

  if (biomarkers.length) {
    lines.push('')
    lines.push('=== MEDICAL BIOMARKERS (most recent results) ===')
    // Group by exam
    const byExam: Record<string, typeof biomarkers> = {}
    for (const b of biomarkers) {
      const examData = b.medical_exams as Record<string, unknown> | null
      const key = `${examData?.exam_date ?? 'unknown'} — ${examData?.title ?? ''}`
      if (!byExam[key]) byExam[key] = []
      byExam[key].push(b)
    }
    for (const [exam, vals] of Object.entries(byExam).slice(0, 3)) {
      lines.push(`  Exam: ${exam}`)
      for (const v of vals) {
        const flagStr = v.flag && v.flag !== 'normal' ? ` ⚠️ ${v.flag.toUpperCase()}` : ''
        const refStr  = v.ref_low && v.ref_high ? ` [ref: ${v.ref_low}–${v.ref_high}]` : ''
        lines.push(`    ${v.name}: ${v.value} ${v.unit ?? ''}${refStr}${flagStr}`)
      }
    }
  }

  if (similar.length) {
    lines.push('')
    lines.push('=== COMMUNITY PATTERNS (similar athletes) ===')
    for (const c of similar) {
      lines.push(`  Story: "${c.story_title}"`)
      lines.push(`    Profile: ${c.age_group}, ${c.sport_focus}, ${c.experience}`)
      lines.push(`    Baseline HRV ${c.baseline_hrv}ms → training ${c.weekly_hours}h/wk, ${c.zone2_pct}% Zone 2`)
      lines.push(`    Outcome: ${c.outcome_metric} changed by ${c.outcome_delta > 0 ? '+' : ''}${c.outcome_delta} over ${c.outcome_weeks} weeks`)
      lines.push(`    Summary: ${c.story_summary}`)
    }
  }

  return lines.join('\n')
}
