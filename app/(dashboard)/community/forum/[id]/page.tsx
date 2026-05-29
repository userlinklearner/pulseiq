import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PostView } from './PostView'

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [postRes, commentsRes] = await Promise.all([
    supabase
      .from('forum_posts')
      .select('*, profiles(display_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('forum_comments')
      .select('*, profiles(display_name)')
      .eq('post_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!postRes.data) notFound()

  return (
    <PostView
      post={postRes.data}
      comments={commentsRes.data ?? []}
      currentUserId={user.id}
    />
  )
}
