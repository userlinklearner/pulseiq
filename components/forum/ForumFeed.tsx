'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, ArrowUp, Pin, Flame, Clock, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  { key: 'all',          label: 'All',          color: 'text-white/60' },
  { key: 'training',     label: 'Training',     color: 'text-blue-400' },
  { key: 'nutrition',    label: 'Nutrition',    color: 'text-emerald-400' },
  { key: 'recovery',     label: 'Recovery',     color: 'text-violet-400' },
  { key: 'gear',         label: 'Gear',         color: 'text-amber-400' },
  { key: 'race_reports', label: 'Race Reports', color: 'text-rose-400' },
  { key: 'mental',       label: 'Mental',       color: 'text-cyan-400' },
  { key: 'science',      label: 'Science',      color: 'text-indigo-400' },
  { key: 'general',      label: 'General',      color: 'text-white/50' },
]

const CATEGORY_COLORS: Record<string, string> = {
  training:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  nutrition:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  recovery:     'bg-violet-500/20 text-violet-400 border-violet-500/30',
  gear:         'bg-amber-500/20 text-amber-400 border-amber-500/30',
  race_reports: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  mental:       'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  science:      'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  general:      'bg-white/10 text-white/50',
}

const SORT_OPTS = [
  { key: 'hot',   label: 'Hot',   icon: Flame },
  { key: 'new',   label: 'New',   icon: Clock },
  { key: 'top',   label: 'Top',   icon: TrendingUp },
]

interface ForumPost {
  id: string
  user_id: string
  title: string
  body: string
  category: string
  upvotes: number
  comment_count: number
  pinned: boolean
  created_at: string
  profiles: { display_name: string | null } | null
}

interface Props {
  posts: ForumPost[]
  currentUserId: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function ForumFeed({ posts, currentUserId }: Props) {
  const [category, setCategory] = useState('all')
  const [sort,     setSort]     = useState('hot')
  const [votes,    setVotes]    = useState<Record<string, number>>({})

  const filtered = posts
    .filter(p => category === 'all' || p.category === category)
    .sort((a, b) => {
      if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'top') return (b.upvotes + (votes[b.id] ?? 0)) - (a.upvotes + (votes[a.id] ?? 0))
      // hot: score = upvotes / (age_hours + 2)^1.5
      const scoreA = (a.upvotes + (votes[a.id] ?? 0)) / Math.pow(((Date.now() - new Date(a.created_at).getTime()) / 3600000 + 2), 1.5)
      const scoreB = (b.upvotes + (votes[b.id] ?? 0)) / Math.pow(((Date.now() - new Date(b.created_at).getTime()) / 3600000 + 2), 1.5)
      // pinned always first
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return scoreB - scoreA
    })

  async function vote(postId: string) {
    if (votes[postId]) return // already voted
    setVotes(v => ({ ...v, [postId]: 1 }))
    const supabase = createClient()
    await supabase.from('forum_votes').upsert({
      user_id: currentUserId, target_id: postId, target_type: 'post', value: 1
    }, { onConflict: 'user_id,target_id', ignoreDuplicates: true })
  }

  return (
    <div className="space-y-4">
      {/* Sort + category filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
          {SORT_OPTS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSort(key)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                sort === key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              )}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                category === c.key
                  ? 'bg-white/15 text-white'
                  : `${c.color} hover:bg-white/5`
              )}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm">
            No posts in this category yet. Be the first!
          </div>
        )}

        {filtered.map(post => {
          const voted      = !!votes[post.id]
          const totalVotes = post.upvotes + (votes[post.id] ?? 0)
          const author     = post.profiles?.display_name ?? 'Anonymous'

          return (
            <div key={post.id}
              className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors group">

              {/* Vote column */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                <button
                  onClick={() => vote(post.id)}
                  disabled={voted || post.user_id === currentUserId}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    voted
                      ? 'text-emerald-400 bg-emerald-500/20'
                      : 'text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10'
                  )}>
                  <ArrowUp className="w-4 h-4" />
                </button>
                <span className={cn('text-sm font-bold tabular-nums',
                  totalVotes > 0 ? 'text-emerald-400' : 'text-white/40')}>
                  {totalVotes}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {post.pinned && (
                    <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  )}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                    CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.general
                  )}>
                    {post.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-white/30">
                    by <span className="text-white/50">{author}</span>
                  </span>
                  <span className="text-xs text-white/20">{timeAgo(post.created_at)}</span>
                </div>

                <Link href={`/community/forum/${post.id}`}
                  className="block group-hover:text-violet-300 transition-colors">
                  <h3 className="text-sm font-semibold text-white leading-snug mb-1">
                    {post.title}
                  </h3>
                  <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
                    {post.body}
                  </p>
                </Link>

                <div className="flex items-center gap-4 mt-2">
                  <Link href={`/community/forum/${post.id}`}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
