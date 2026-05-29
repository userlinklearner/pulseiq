'use client'

import { useState } from 'react'
import { Zap, TrendingUp, Users, MessageCircle, Calendar, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COACH_FEATURES = [
  { icon: MessageCircle, text: 'AI coach chat — ask anything about your data' },
  { icon: TrendingUp,    text: 'Compare your trajectory to similar athletes' },
  { icon: Users,         text: 'Community patterns: what worked for people like you' },
  { icon: Calendar,      text: 'AI-generated training plans tailored to your data' },
  { icon: Star,          text: 'Pattern warnings before overtraining happens' },
  { icon: Zap,           text: 'Progress predictions based on real outcomes' },
]

interface Props {
  onUpgrade?: () => void
}

export function UpgradeGate({ onUpgrade }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">PulseIQ Coach</h2>
          <p className="text-white/50 text-lg">
            Your data is powerful. Now learn from everyone else's.
          </p>
        </div>

        {/* Features */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3">
          {COACH_FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-sm text-white/80">{text}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-emerald-300 text-center">
            <span className="font-semibold">7-day free trial.</span> Cancel anytime. No lock-in.
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={onUpgrade ?? handleUpgrade}
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white h-12 text-base font-semibold"
        >
          {loading ? 'Loading...' : 'Start 7-day free trial'}
        </Button>
        <p className="text-center text-xs text-white/25 mt-3">
          Then pay as you go. Cancel anytime from your settings.
        </p>
      </div>
    </div>
  )
}
