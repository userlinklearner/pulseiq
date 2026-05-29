'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Users, Lock, ArrowRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

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
  strength_days: number
  avg_sleep_hours: number
  avg_mood: number
  avg_stress: number
  story_title: string
  story_summary: string
  verified: boolean
}

const SPORTS  = ['All', 'running', 'triathlon', 'cycling', 'strength', 'wellness', 'mixed']
const GOALS   = ['All', 'endurance', 'speed', 'health', 'weight', 'strength']
const METRICS = ['All', '5k_seconds', 'hrv', 'rhr', 'sleep_hours', 'recovery_score']

const METRIC_LABELS: Record<string, string> = {
  '5k_seconds':     '5K time',
  'hrv':            'HRV',
  'rhr':            'Resting HR',
  'sleep_hours':    'Sleep',
  'recovery_score': 'Recovery',
}

function formatDelta(metric: string, delta: number): string {
  if (metric === '5k_seconds') {
    const abs  = Math.abs(delta)
    const sign = delta < 0 ? '-' : '+'
    const mins = Math.floor(abs / 60)
    const secs = Math.round(abs % 60)
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`
  }
  const sign = delta > 0 ? '+' : ''
  const units: Record<string, string> = { hrv: 'ms', rhr: 'bpm', sleep_hours: 'h', recovery_score: 'pts' }
  return `${sign}${Math.abs(delta).toFixed(1)} ${units[metric] ?? ''}`
}

function isImprovement(metric: string, delta: number): boolean {
  if (metric === 'rhr' || metric === '5k_seconds') return delta < 0
  return delta > 0
}

interface Props {
  profiles:     CommunityProfile[]
  isCoach:      boolean
  userSport?:   string | null
  userAgeGroup?: string | null
  userGoal?:    string | null
}

export function CommunityBrowser({ profiles, isCoach, userSport, userAgeGroup }: Props) {
  const [sport,  setSport]  = useState('All')
  const [goal,   setGoal]   = useState('All')
  const [metric, setMetric] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = profiles.filter(p => {
    if (sport  !== 'All' && p.sport_focus !== sport)     return false
    if (goal   !== 'All' && p.goal        !== goal)      return false
    if (metric !== 'All' && p.outcome_metric !== metric) return false
    if (search && !p.story_title.toLowerCase().includes(search.toLowerCase()) &&
                  !p.story_summary.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Stats
  const improvements = profiles.filter(p => isImprovement(p.outcome_metric, p.outcome_delta))
  const avgWeeks     = Math.round(profiles.reduce((s, p) => s + p.outcome_weeks, 0) / (profiles.length || 1))

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Athlete stories',   value: profiles.length.toString() },
          { label: 'Saw improvement',   value: `${Math.round(improvements.length / (profiles.length || 1) * 100)}%` },
          { label: 'Avg outcome time',  value: `${avgWeeks} weeks` },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/30 self-center">Sport:</span>
          {SPORTS.map(s => (
            <button key={s} onClick={() => setSport(s)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize',
                sport === s ? 'bg-violet-500/40 text-violet-200 border border-violet-500/50'
                           : 'bg-white/5 text-white/40 hover:bg-white/10'
              )}>
              {s === 'All' ? 'All sports' : s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/30 self-center">Goal:</span>
          {GOALS.map(g => (
            <button key={g} onClick={() => setGoal(g)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize',
                goal === g ? 'bg-indigo-500/40 text-indigo-200 border border-indigo-500/50'
                           : 'bg-white/5 text-white/40 hover:bg-white/10'
              )}>
              {g === 'All' ? 'All goals' : g}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/30 self-center">Metric:</span>
          {METRICS.map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                metric === m ? 'bg-emerald-500/40 text-emerald-200 border border-emerald-500/50'
                             : 'bg-white/5 text-white/40 hover:bg-white/10'
              )}>
              {m === 'All' ? 'All metrics' : METRIC_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-white/30">
        {filtered.length} {filtered.length === 1 ? 'story' : 'stories'} found
      </p>

      {/* Story cards */}
      <div className="space-y-4">
        {filtered.map((p, idx) => {
          const improved    = isImprovement(p.outcome_metric, p.outcome_delta)
          const isSimilar   = (userSport && p.sport_focus === userSport.toLowerCase()) ||
                              (userAgeGroup && p.age_group === userAgeGroup)
          // Free users see first 2 fully, rest blurred
          const isLocked    = !isCoach && idx >= 2

          return (
            <Card key={p.id} className={cn(
              'relative overflow-hidden transition-colors',
              isSimilar && 'border-violet-500/25',
              isLocked && 'opacity-60'
            )}>
              {isLocked && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                  <Lock className="w-6 h-6 text-white/40" />
                  <p className="text-sm text-white/60 text-center px-4">
                    Upgrade to Coach to read all {profiles.length} athlete stories
                  </p>
                  <Button size="sm" asChild>
                    <Link href="/coach">Upgrade to Coach</Link>
                  </Button>
                </div>
              )}

              <CardContent className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {isSimilar && <Badge variant="info">Similar to you</Badge>}
                      {p.verified && <Badge variant="success">Verified</Badge>}
                    </div>
                    <h3 className="text-base font-semibold text-white leading-snug">{p.story_title}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="default" className="capitalize">{p.age_group}</Badge>
                      <Badge variant="default" className="capitalize">{p.sport_focus}</Badge>
                      <Badge variant="default" className="capitalize">{p.experience}</Badge>
                      <Badge variant="default" className="capitalize">{p.goal}</Badge>
                    </div>
                  </div>

                  {/* Outcome */}
                  <div className={cn(
                    'flex-shrink-0 text-center px-4 py-3 rounded-xl border min-w-[80px]',
                    improved
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-amber-500/10 border-amber-500/20'
                  )}>
                    <div className="flex items-center gap-1 justify-center">
                      {improved
                        ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        : <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                      }
                      <span className={cn(
                        'text-lg font-bold tabular-nums',
                        improved ? 'text-emerald-400' : 'text-amber-400'
                      )}>
                        {formatDelta(p.outcome_metric, p.outcome_delta)}
                      </span>
                    </div>
                    <p className="text-xs text-white/30">{METRIC_LABELS[p.outcome_metric] ?? p.outcome_metric}</p>
                    <p className="text-xs text-white/20">{p.outcome_weeks}w</p>
                  </div>
                </div>

                {/* Training snapshot */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'hrs/week',    value: p.weekly_hours.toString() },
                    { label: 'Zone 2 %',    value: `${p.zone2_pct}%` },
                    { label: 'Strength/wk', value: `${p.strength_days}d` },
                    { label: 'Avg sleep',   value: `${p.avg_sleep_hours}h` },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-white">{s.value}</p>
                      <p className="text-xs text-white/30">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Baseline */}
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>Starting HRV: <span className="text-white/60">{p.baseline_hrv}ms</span></span>
                  <span>Starting RHR: <span className="text-white/60">{p.baseline_rhr}bpm</span></span>
                  {p.avg_mood && <span>Avg mood: <span className="text-white/60">{p.avg_mood}/10</span></span>}
                </div>

                {/* Story */}
                <p className="text-sm text-white/60 leading-relaxed">{p.story_summary}</p>

                {/* CTA */}
                {isCoach && (
                  <Link
                    href={`/coach?prompt=${encodeURIComponent(`Tell me more about the athlete who achieved "${p.story_title}" and how I can replicate it based on my data`)}`}
                    className="flex items-center gap-1.5 text-xs text-violet-400/70 hover:text-violet-400 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                    Ask your coach how to replicate this
                  </Link>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!isCoach && filtered.length > 2 && (
        <div className="text-center py-6">
          <p className="text-white/40 text-sm mb-4">
            {filtered.length - 2} more stories hidden
          </p>
          <Button asChild>
            <Link href="/coach">Unlock all stories with Coach</Link>
          </Button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No stories match these filters yet.</p>
          <p className="text-white/25 text-xs mt-1">More data coming as the community grows.</p>
        </div>
      )}
    </div>
  )
}
