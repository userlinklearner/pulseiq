'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = [
  { key: 'training',     label: 'Training',     emoji: '🏋️' },
  { key: 'nutrition',    label: 'Nutrition',    emoji: '🥗' },
  { key: 'recovery',     label: 'Recovery',     emoji: '😴' },
  { key: 'gear',         label: 'Gear',         emoji: '⌚' },
  { key: 'race_reports', label: 'Race Report',  emoji: '🏁' },
  { key: 'mental',       label: 'Mental',       emoji: '🧠' },
  { key: 'science',      label: 'Science',      emoji: '🔬' },
  { key: 'general',      label: 'General',      emoji: '💬' },
]

export default function NewPostPage() {
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [category, setCategory] = useState('general')
  const [posting,  setPosting]  = useState(false)
  const [error,    setError]    = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return }
    setPosting(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setPosting(false); return }

    const { data, error: err } = await supabase
      .from('forum_posts')
      .insert({ user_id: user.id, title: title.trim(), body: body.trim(), category })
      .select()
      .single()

    if (err) { setError(err.message); setPosting(false); return }
    router.push(`/community/forum/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/community" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-white">New post</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Share with the community</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="text-xs text-white/40 block mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c.key} type="button"
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      category === c.key
                        ? 'bg-violet-500/30 text-violet-200 border-violet-500/40'
                        : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                    )}>
                    <span>{c.emoji}</span>{c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={200}
                placeholder="What's your post about?"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
              />
              <p className="text-xs text-white/20 text-right mt-1">{title.length}/200</p>
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Post</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                placeholder="Share your experience, ask a question, or start a discussion..."
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none leading-relaxed"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" type="button" asChild>
                <Link href="/community">Cancel</Link>
              </Button>
              <Button type="submit" disabled={posting || !title.trim() || !body.trim()}>
                {posting ? 'Posting...' : 'Post to community'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
