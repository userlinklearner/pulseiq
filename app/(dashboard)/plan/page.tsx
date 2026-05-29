import { createClient } from '@/lib/supabase/server'
import { UpgradeGate } from '@/components/paywall/UpgradeGate'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Dumbbell, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const INTENSITY_COLORS: Record<string, string> = {
  easy:     'text-emerald-400',
  moderate: 'text-amber-400',
  hard:     'text-red-400',
  rest:     'text-white/25',
}

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: sub } = await supabase
    .from('subscriptions').select('plan, status').eq('user_id', user.id).single()
  const isCoach = sub?.plan === 'coach' && (sub.status === 'active' || sub.status === 'trialing')

  if (!isCoach) return <UpgradeGate />

  const { data: plans } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const activePlan = plans?.find(p => p.status === 'active')
  const pastPlans  = plans?.filter(p => p.status !== 'active') ?? []

  if (!plans?.length) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">No training plan yet</h2>
          <p className="text-white/40 max-w-sm">
            Ask your coach to build a personalized plan based on your data and goals.
          </p>
        </div>
        <Button asChild>
          <Link href="/coach?prompt=Build+me+a+training+plan+based+on+my+current+data+and+goals">
            <ArrowRight className="w-4 h-4 mr-2" />
            Ask coach to build a plan
          </Link>
        </Button>
      </div>
    )
  }

  // Compute current week of active plan
  const currentWeekIndex = activePlan
    ? Math.max(0, Math.floor(
        (Date.now() - new Date(activePlan.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000)
      ))
    : 0

  const weeks = (activePlan?.weeks ?? []) as Array<{
    week: number
    theme: string
    volume: string
    days: Array<{ day: string; session: string; type: string; duration_mins: number; intensity: string }>
  }>
  const currentWeek = weeks[currentWeekIndex] ?? weeks[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Plan</h1>
          <p className="text-white/40 text-sm mt-1">Your AI-generated program</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/coach?prompt=Update+my+training+plan">Adjust plan</Link>
        </Button>
      </div>

      {activePlan && (
        <>
          {/* Plan header */}
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{activePlan.title}</h2>
                  <p className="text-white/50 text-sm mt-0.5">{activePlan.goal}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="success">Active</Badge>
                    <Badge variant="info">Week {currentWeekIndex + 1} of {activePlan.duration_weeks}</Badge>
                    <span className="text-xs text-white/30">Started {activePlan.start_date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-violet-400">
                    {Math.round(((currentWeekIndex + 1) / (activePlan.duration_weeks || 1)) * 100)}%
                  </div>
                  <p className="text-xs text-white/30">complete</p>
                </div>
              </div>
              {activePlan.ai_rationale && (
                <p className="text-xs text-violet-300/60 italic mt-3 pt-3 border-t border-violet-500/20">
                  {activePlan.ai_rationale}
                </p>
              )}
            </CardContent>
          </Card>

          {/* This week */}
          {currentWeek && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white/40" />
                      This week — Week {currentWeek.week}
                    </div>
                  </CardTitle>
                  <Badge variant="info" className="capitalize">{currentWeek.theme}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {currentWeek.days?.map(d => (
                  <div key={d.day}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="text-white/30 text-xs w-14 flex-shrink-0 font-mono">{d.day.slice(0, 3).toUpperCase()}</span>
                    <span className={cn('text-sm flex-1', INTENSITY_COLORS[d.intensity] ?? 'text-white/70')}>
                      {d.session}
                    </span>
                    {d.duration_mins > 0 && (
                      <span className="text-xs text-white/30 flex-shrink-0">{d.duration_mins}min</span>
                    )}
                    <span className={cn('text-xs capitalize flex-shrink-0 w-16 text-right',
                      INTENSITY_COLORS[d.intensity] ?? 'text-white/30')}>
                      {d.intensity}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Full plan overview */}
          {weeks.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Full plan overview</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {weeks.map(w => (
                    <div key={w.week}
                      className={cn(
                        'p-3 rounded-xl border text-center transition-colors',
                        w.week === currentWeekIndex + 1
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : w.week < currentWeekIndex + 1
                          ? 'border-white/5 bg-white/3 opacity-50'
                          : 'border-white/10 bg-white/5'
                      )}>
                      <p className="text-xs text-white/30 mb-1">Week {w.week}</p>
                      <p className="text-xs font-medium text-white/70">{w.theme}</p>
                      <Badge variant={
                        w.volume === 'high' ? 'danger' :
                        w.volume === 'moderate' ? 'warning' : 'success'
                      } className="mt-2 text-xs capitalize">
                        {w.volume}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Past plans */}
      {pastPlans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">Past plans</h2>
          <div className="space-y-2">
            {pastPlans.map(p => (
              <div key={p.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="text-xs text-white/30">{p.start_date} · {p.duration_weeks} weeks</p>
                </div>
                <Badge variant="default" className="capitalize">{p.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
