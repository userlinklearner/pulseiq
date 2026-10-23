import { createClient } from '@/lib/supabase/server'
import { mergeDailyMetrics } from '@/lib/metrics/merge'
import { getTimeZone } from '@/lib/timezone'
import { CoachChat } from '@/components/coach/CoachChat'
import { CommunityInsights } from '@/components/coach/CommunityInsights'
import { UpgradeGate } from '@/components/paywall/UpgradeGate'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { daysAgoISO } from '@/lib/utils'
import { History, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function CoachPage() {
  const supabase = await createClient()
  const tz = await getTimeZone()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .single()

  const isCoach = sub?.plan === 'coach' && (sub.status === 'active' || sub.status === 'trialing')

  // Load data regardless (community shown as preview even to free users)
  const [profileRes, communityRes, convRes, metricsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('community_profiles').select('*').order('verified', { ascending: false }),
    isCoach
      ? supabase.from('coach_conversations').select('id, title, created_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    supabase.from('daily_metrics').select('date, source, hrv_avg').eq('user_id', user.id).gte('date', daysAgoISO(7, tz)).not('hrv_avg', 'is', null),
  ])

  const profile   = profileRes.data
  const community = communityRes.data ?? []
  const convs     = convRes.data ?? []
  const metrics   = mergeDailyMetrics(metricsRes.data).filter(m => m.hrv_avg !== null)

  const avgHrv = metrics.length
    ? metrics.reduce((s: number, m: { hrv_avg: number | null }) => s + (m.hrv_avg ?? 0), 0) / metrics.length
    : null

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coach</h1>
          <p className="text-white/40 text-sm mt-0.5">
            AI coaching powered by your data + community patterns
          </p>
        </div>
        {isCoach && (
          <Badge variant="success">
            <Zap className="w-3 h-3 mr-1" />
            {sub.status === 'trialing' ? 'Trial active' : 'Coach active'}
          </Badge>
        )}
      </div>

      {isCoach ? (
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Chat — main area */}
          <div className="lg:col-span-2">
            <Card className="h-[70vh] flex flex-col">
              <CardContent className="flex-1 flex flex-col p-5 min-h-0">
                <CoachChat />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: history + community */}
          <div className="space-y-4">
            {/* Conversation history */}
            {convs.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-white/40" />
                    <CardTitle>Past conversations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  {convs.map((c: { id: string; title: string; created_at: string }) => (
                    <Link
                      key={c.id}
                      href={`/coach?conv=${c.id}`}
                      className="block px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <p className="text-sm text-white/70 truncate">{c.title ?? 'Conversation'}</p>
                      <p className="text-xs text-white/30">
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Community insights */}
            <CommunityInsights
              profiles={community}
              userHrv={avgHrv}
              userSport={profile?.primary_sport}
              userAgeGroup={ageGroup}
            />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Upgrade gate */}
          <div className="lg:col-span-2">
            <UpgradeGate />
          </div>

          {/* Community preview — always visible to show the value */}
          <div className="space-y-4">
            <div className="px-1">
              <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-3">
                Preview — Community data
              </p>
              <p className="text-sm text-white/50 mb-4">
                Upgrade to see which of these stories match your current data — and ask your coach to help you replicate them.
              </p>
            </div>
            <CommunityInsights
              profiles={community.slice(0, 3)}
              userHrv={null}
              userSport={profile?.primary_sport}
              userAgeGroup={ageGroup}
            />
          </div>
        </div>
      )}
    </div>
  )
}
