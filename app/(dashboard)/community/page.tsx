import { createClient } from '@/lib/supabase/server'
import { CommunityBrowser } from './CommunityBrowser'
import { ForumFeed } from '@/components/forum/ForumFeed'
import { Tabs } from './Tabs'
import { Button } from '@/components/ui/button'
import { PenSquare } from 'lucide-react'
import Link from 'next/link'

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'forum' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, communityRes, subRes, postsRes] = await Promise.all([
    supabase.from('profiles').select('primary_sport, birth_year, goal, display_name').eq('id', user.id).single(),
    supabase.from('community_profiles').select('*').order('verified', { ascending: false }),
    supabase.from('subscriptions').select('plan, status').eq('user_id', user.id).single(),
    supabase
      .from('forum_posts')
      .select('*, profiles(display_name)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const profile   = profileRes.data
  const community = communityRes.data ?? []
  const posts     = postsRes.data ?? []
  const isCoach   = subRes.data?.plan === 'coach' &&
                    (subRes.data?.status === 'active' || subRes.data?.status === 'trialing')

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
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Community</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Connect, share, and learn from athletes like you
          </p>
        </div>
        {tab === 'forum' && (
          <Button size="sm" asChild>
            <Link href="/community/forum/new">
              <PenSquare className="w-4 h-4 mr-1.5" />
              New post
            </Link>
          </Button>
        )}
      </div>

      <Tabs active={tab} />

      {tab === 'forum' && (
        <ForumFeed posts={posts} currentUserId={user.id} />
      )}

      {tab === 'stories' && (
        <CommunityBrowser
          profiles={community}
          isCoach={isCoach}
          userSport={profile?.primary_sport}
          userAgeGroup={ageGroup}
          userGoal={profile?.goal}
        />
      )}
    </div>
  )
}
