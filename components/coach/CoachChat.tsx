'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Zap, ChevronDown, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_QUESTIONS = [
  'Should I train hard today?',
  'Why is my HRV dropping?',
  'Build me a 8-week running plan',
  'How do I compare to similar athletes?',
  'What should I focus on this week?',
  'My body battery is always low — why?',
]

function PlanBlock({ content }: { content: string }) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (!match) return null

  let plan: Record<string, unknown>
  try { plan = JSON.parse(match[1]) } catch { return null }

  async function savePlan() {
    setSaving(true)
    await fetch('/api/coach', { method: 'PUT', body: JSON.stringify({ plan }), headers: { 'Content-Type': 'application/json' } })
    setSaving(false)
    setSaved(true)
  }

  const weeks = plan.weeks as Array<{ week: number; theme: string; volume: string; days: Array<{ day: string; session: string; intensity: string }> }>

  return (
    <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-violet-500/20">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">{plan.title as string}</span>
          <span className="text-xs text-violet-400/60">{plan.duration_weeks as number} weeks · {plan.goal as string}</span>
        </div>
        <Button size="sm" variant="outline" onClick={savePlan} disabled={saving || saved}
          className="border-violet-500/30 text-violet-300 hover:bg-violet-500/20 text-xs">
          {saved ? '✓ Saved to Plans' : saving ? 'Saving...' : 'Save Plan'}
        </Button>
      </div>
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {weeks?.slice(0, 3).map((w) => (
          <div key={w.week}>
            <p className="text-xs font-semibold text-violet-300 mb-1.5">Week {w.week} — {w.theme}</p>
            <div className="grid grid-cols-1 gap-1">
              {w.days?.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="text-white/30 w-16 flex-shrink-0">{d.day.slice(0,3)}</span>
                  <span className={cn(
                    'text-white/70',
                    d.intensity === 'easy' ? 'text-emerald-400/80' :
                    d.intensity === 'moderate' ? 'text-amber-400/80' :
                    d.intensity === 'hard' ? 'text-red-400/80' :
                    'text-white/30'
                  )}>{d.session}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {weeks?.length > 3 && (
          <p className="text-xs text-white/30">+ {weeks.length - 3} more weeks saved in your plan</p>
        )}
      </div>
      {typeof plan.ai_rationale === 'string' && plan.ai_rationale && (
        <div className="px-4 py-3 border-t border-violet-500/20">
          <p className="text-xs text-violet-300/70 italic">{plan.ai_rationale}</p>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const hasPlan = message.content.includes('```json')

  // Strip JSON block from displayed text
  const displayContent = message.content.replace(/```json\n[\s\S]*?\n```/, '').trim()

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
        isUser
          ? 'bg-white/10 text-white/60'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600'
      )}>
        {isUser
          ? <span className="text-xs font-bold">You</span>
          : <Zap className="w-4 h-4 text-white" />
        }
      </div>

      {/* Content */}
      <div className={cn('max-w-[78%] space-y-1', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-white/10 text-white rounded-tr-sm'
            : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-sm'
        )}>
          {/* Render markdown-like formatting */}
          {displayContent.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold text-white mt-2 mb-1">{line.slice(2, -2)}</p>
            }
            if (line.startsWith('• ') || line.startsWith('- ')) {
              return <p key={i} className="pl-3 text-white/80">{line}</p>
            }
            if (line === '') return <span key={i} className="block h-2" />
            return <p key={i}>{line}</p>
          })}
        </div>

        {/* Training plan block */}
        {hasPlan && !isUser && <PlanBlock content={message.content} />}
      </div>
    </div>
  )
}

export function CoachChat({ conversationId }: { conversationId?: string }) {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [streaming,   setStreaming]   = useState(false)
  const [convId,      setConvId]      = useState(conversationId)
  const [showQuick,   setShowQuick]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const userMessage: Message = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setShowQuick(false)
    setStreaming(true)

    // Placeholder for streaming
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, conversationId: convId }),
      })

      if (!res.ok) throw new Error(await res.text())

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const { text } = JSON.parse(data)
            full += text
            setMessages(m => {
              const copy = [...m]
              copy[copy.length - 1] = { role: 'assistant', content: full }
              return copy
            })
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(m => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Welcome state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Your PulseIQ Coach</h3>
              <p className="text-white/40 text-sm max-w-sm">
                I have your full health data and patterns from hundreds of similar athletes.
                Ask me anything.
              </p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {/* Streaming indicator */}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {showQuick && messages.length === 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowQuick(false)}
            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/50 mb-2"
          >
            <ChevronDown className="w-3 h-3" />
            Suggested questions
          </button>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end border-t border-white/10 pt-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={streaming}
          placeholder="Ask your coach anything..."
          rows={1}
          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none min-h-[44px] max-h-32"
          style={{ height: 'auto' }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 128) + 'px'
          }}
        />
        <Button
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          size="icon"
          className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 flex-shrink-0"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
