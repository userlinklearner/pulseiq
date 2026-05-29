'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, MessageSquare, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface Comment {
  id: string
  user_id: string
  parent_id: string | null
  body: string
  upvotes: number
  created_at: string
  profiles: { display_name: string | null } | null
}

interface Post {
  id: string
  user_id: string
  title: string
  body: string
  category: string
  upvotes: number
  comment_count: number
  created_at: string
  profiles: { display_name: string | null } | null
}

function CommentThread({
  comments, parentId = null, depth = 0, currentUserId, onVote, votes
}: {
  comments: Comment[]
  parentId: string | null
  depth: number
  currentUserId: string
  onVote: (id: string) => void
  votes: Record<string, number>
}) {
  const children = comments.filter(c => c.parent_id === parentId)
  if (!children.length) return null

  return (
    <div className={cn('space-y-3', depth > 0 && 'ml-6 pl-4 border-l border-white/10')}>
      {children.map(comment => {
        const voted      = !!votes[comment.id]
        const totalVotes = comment.upvotes + (votes[comment.id] ?? 0)
        const author     = comment.profiles?.display_name ?? 'Anonymous'

        return (
          <div key={comment.id} className="space-y-3">
            <div className="flex gap-3">
              {/* Vote */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1">
                <button onClick={() => onVote(comment.id)} disabled={voted || comment.user_id === currentUserId}
                  className={cn('p-1 rounded transition-colors',
                    voted ? 'text-emerald-400' : 'text-white/20 hover:text-emerald-400'
                  )}>
                  <ArrowUp className="w-3 h-3" />
                </button>
                <span className={cn('text-xs tabular-nums', totalVotes > 0 ? 'text-emerald-400' : 'text-white/30')}>
                  {totalVotes}
                </span>
              </div>

              {/* Comment body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-white/60">{author}</span>
                  <span className="text-xs text-white/25">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
              </div>
            </div>

            {/* Nested replies */}
            {depth < 3 && (
              <CommentThread
                comments={comments}
                parentId={comment.id}
                depth={depth + 1}
                currentUserId={currentUserId}
                onVote={onVote}
                votes={votes}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PostView({ post, comments: initialComments, currentUserId }: {
  post: Post
  comments: Comment[]
  currentUserId: string
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [reply,    setReply]    = useState('')
  const [posting,  setPosting]  = useState(false)
  const [votes,    setVotes]    = useState<Record<string, number>>({})
  const [postVote, setPostVote] = useState(0)

  async function votePost() {
    if (postVote || post.user_id === currentUserId) return
    setPostVote(1)
    const supabase = createClient()
    await supabase.from('forum_votes').insert({
      user_id: currentUserId, target_id: post.id, target_type: 'post', value: 1
    })
  }

  async function voteComment(commentId: string) {
    if (votes[commentId]) return
    setVotes(v => ({ ...v, [commentId]: 1 }))
    const supabase = createClient()
    await supabase.from('forum_votes').insert({
      user_id: currentUserId, target_id: commentId, target_type: 'comment', value: 1
    })
  }

  async function submitReply() {
    if (!reply.trim()) return
    setPosting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('forum_comments')
      .insert({ post_id: post.id, user_id: currentUserId, body: reply.trim() })
      .select('*, profiles(display_name)')
      .single()
    if (data) setComments(c => [...c, data as Comment])
    setReply('')
    setPosting(false)
  }

  const author = post.profiles?.display_name ?? 'Anonymous'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/community" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Back to community
      </Link>

      {/* Post */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4">
        <div className="flex gap-4">
          {/* Vote */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button onClick={votePost} disabled={!!postVote || post.user_id === currentUserId}
              className={cn('p-2 rounded-xl transition-colors',
                postVote ? 'text-emerald-400 bg-emerald-500/20' : 'text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10'
              )}>
              <ArrowUp className="w-5 h-5" />
            </button>
            <span className={cn('text-base font-bold', (post.upvotes + postVote) > 0 ? 'text-emerald-400' : 'text-white/40')}>
              {post.upvotes + postVote}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium capitalize',
                CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.general)}>
                {post.category.replace('_', ' ')}
              </span>
              <span className="text-xs text-white/40">
                by <span className="text-white/60">{author}</span>
              </span>
              <span className="text-xs text-white/25">{timeAgo(post.created_at)}</span>
            </div>

            <h1 className="text-xl font-bold text-white mb-3">{post.title}</h1>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{post.body}</p>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 text-xs text-white/30">
              <MessageSquare className="w-3.5 h-3.5" />
              {comments.length} comments
            </div>
          </div>
        </div>
      </div>

      {/* Reply box */}
      <div className="flex gap-3">
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          rows={3}
          placeholder="Write a comment..."
          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none"
        />
        <Button onClick={submitReply} disabled={posting || !reply.trim()} size="icon" className="h-auto self-end mb-0.5 rounded-xl">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">
            {comments.length} comments
          </h2>
          <CommentThread
            comments={comments}
            parentId={null}
            depth={0}
            currentUserId={currentUserId}
            onVote={voteComment}
            votes={votes}
          />
        </div>
      )}
    </div>
  )
}
