import { TrendingUp, TrendingDown, Users, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CommunityProfile {
  id: string
  age_group: string
  sport_focus: string
  goal: string
  experience: string
  baseline_hrv: number
  baseline_rhr: number
  outcome_weeks: number
  outcome_metric: string
  outcome_before: number
  outcome_after: number
  outcome_delta: number
  weekly_hours: number
  zone2_pct: number
  avg_sleep_hours: number
  story_title: string
  story_summary: string
}

interface Props {
  profiles: CommunityProfile[]
  userHrv?: number | null
  userSport?: string | null
  userAgeGroup?: string | null
}

const METRIC_LABELS: Record<string, string> = {
  '5k_seconds':     '5K time',
  'hrv':            'HRV',
  'rhr':            'Resting HR',
  'sleep_hours':    'Sleep',
  'recovery_score': 'Recovery score',
}

const METRIC_UNITS: Record<string, string> = {
  '5k_seconds':     's',
  'hrv':            'ms',
  'rhr':            'bpm',
  'sleep_hours':    'h',
  'recovery_score': 'pts',
}

function formatDelta(metric: string, delta: number): string {
  if (metric === '5k_seconds') {
    const abs = Math.abs(delta)
    const sign = delta < 0 ? '-' : '+'
    const mins = Math.floor(abs / 60)
    const secs = Math.round(abs % 60)
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} ${METRIC_UNITS[metric] ?? ''}`
}

function isImprovement(metric: string, delta: number): boolean {
  // For RHR and 5K time, lower is better
  if (metric === 'rhr' || metric === '5k_seconds') return delta < 0
  return delta > 0
}

export function CommunityInsights({ profiles, userHrv, userSport, userAgeGroup }: Props) {
  if (!profiles.length) return null

  // Sort by similarity to user
  const sorted = [...profiles].sort((a, b) => {
    let scoreA = 0, scoreB = 0
    if (userSport && a.sport_focus === userSport.toLowerCase()) scoreA += 2
    if (userSport && b.sport_focus === userSport.toLowerCase()) scoreB += 2
    if (userAgeGroup && a.age_group === userAgeGroup) scoreA += 1
    if (userAgeGroup && b.age_group === userAgeGroup) scoreB += 1
    if (userHrv && Math.abs(a.baseline_hrv - userHrv) < 10) scoreA += 1
    if (userHrv && Math.abs(b.baseline_hrv - userHrv) < 10) scoreB += 1
    return scoreB - scoreA
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
          Athletes like you
        </h3>
        <Badge variant="info">{profiles.length} stories</Badge>
      </div>

      <div className="space-y-3">
        {sorted.map(profile => {
          const improved    = isImprovement(profile.outcome_metric, profile.outcome_delta)
          const deltaStr    = formatDelta(profile.outcome_metric, profile.outcome_delta)
          const metricLabel = METRIC_LABELS[profile.outcome_metric] ?? profile.outcome_metric
          const isSimilar   = (userSport && profile.sport_focus === userSport.toLowerCase()) ||
                              (userAgeGroup && profile.age_group === userAgeGroup)

          return (
            <Card key={profile.id} className={cn(
              'transition-colors',
              isSimilar && 'border-violet-500/25 bg-violet-500/5'
            )}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">
                      {profile.story_title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="default" className="capitalize">{profile.age_group}</Badge>
                      <Badge variant="default" className="capitalize">{profile.sport_focus}</Badge>
                      <Badge variant="default" className="capitalize">{profile.experience}</Badge>
                      {isSimilar && <Badge variant="info">Similar to you</Badge>}
                    </div>
                  </div>

                  {/* Outcome */}
                  <div className={cn(
                    'flex-shrink-0 text-right px-3 py-2 rounded-xl border',
                    improved
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  )}>
                    <div className="flex items-center gap-1 justify-end">
                      {improved
                        ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                        : <TrendingDown className="w-3 h-3 text-red-400" />
                      }
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        improved ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {deltaStr}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 text-right">{metricLabel}</p>
                    <p className="text-xs text-white/25 text-right">in {profile.outcome_weeks}w</p>
                  </div>
                </div>

                {/* What they did */}
                <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/5">
                  <div>
                    <p className="text-xs text-white/30">Weekly hrs</p>
                    <p className="text-sm font-semibold text-white">{profile.weekly_hours}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Zone 2 %</p>
                    <p className="text-sm font-semibold text-white">{profile.zone2_pct}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Avg sleep</p>
                    <p className="text-sm font-semibold text-white">{profile.avg_sleep_hours}h</p>
                  </div>
                </div>

                {/* Story */}
                <p className="text-xs text-white/50 leading-relaxed">{profile.story_summary}</p>

                {/* Ask coach about this */}
                <button className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-400 transition-colors">
                  <ArrowRight className="w-3 h-3" />
                  Ask your coach how to replicate this
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
