import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildCoachContext } from '@/lib/coach/context'
import { COACH_SYSTEM_PROMPT } from '@/lib/coach/system-prompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  const isCoach = sub?.plan === 'coach' && (sub.status === 'active' || sub.status === 'trialing')
  if (!isCoach) return NextResponse.json({ error: 'Coach subscription required' }, { status: 403 })

  const { messages, conversationId } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    conversationId?: string
  }

  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  // Build context
  const context = await buildCoachContext(user.id)
  const systemWithContext = `${COACH_SYSTEM_PROMPT}\n\n${context}`

  // Stream response
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: systemWithContext,
    messages,
  })

  // Save conversation in background (don't await)
  stream.finalMessage().then(async (final) => {
    const assistantContent = final.content[0].type === 'text' ? final.content[0].text : ''
    const allMessages = [
      ...messages,
      { role: 'assistant', content: assistantContent, created_at: new Date().toISOString() }
    ]

    if (conversationId) {
      await supabase.from('coach_conversations')
        .update({ messages: allMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId).eq('user_id', user.id)
    } else {
      // Auto-title from first user message
      const title = messages[0]?.content?.slice(0, 60) + (messages[0]?.content?.length > 60 ? '...' : '')
      await supabase.from('coach_conversations').insert({
        user_id:  user.id,
        title,
        messages: allMessages,
      })
    }
  }).catch(console.error)

  // Return SSE stream
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// Save a training plan extracted from coach response
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json()
  if (!plan) return NextResponse.json({ error: 'No plan data' }, { status: 400 })

  const { data, error } = await supabase.from('training_plans').insert({
    user_id:        user.id,
    title:          plan.title,
    goal:           plan.goal,
    duration_weeks: plan.duration_weeks,
    start_date:     new Date().toISOString().split('T')[0],
    weeks:          plan.weeks,
    ai_rationale:   plan.ai_rationale,
    status:         'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}
