'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UserPlus, X, CheckCircle2 } from 'lucide-react'

interface Props {
  role: 'coach' | 'doctor'
}

export function InviteModal({ role }: Props) {
  const [open,    setOpen]    = useState(false)
  const [email,   setEmail]   = useState('')
  const [relType, setRelType] = useState<'coach' | 'doctor'>(role)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ link: string } | null>(null)
  const [error,   setError]   = useState('')

  function reset() {
    setEmail('')
    setMessage('')
    setResult(null)
    setError('')
    setLoading(false)
  }

  function handleClose() {
    setOpen(false)
    setTimeout(reset, 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, relationship_type: relType, message }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    setResult({ link: data.invite_url })
    setLoading(false)
  }

  const label = role === 'doctor' ? 'patient' : 'athlete'

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <UserPlus className="w-4 h-4" />
        Invite {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[#0d0f17] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Invite {label}
              </h2>
              <button
                onClick={handleClose}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {result ? (
              /* Success state */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">Invitation created!</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      Share this link with {email}. They&apos;ll need to be signed in to accept.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-white/40">Invite link</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={result.link}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 font-mono focus:outline-none"
                    />
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(result.link)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <Button onClick={handleClose} className="w-full">Done</Button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 block mb-1.5">
                    {label.charAt(0).toUpperCase() + label.slice(1)}&apos;s PulseIQ email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="patient@example.com"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/50"
                  />
                  <p className="text-xs text-white/30 mt-1">
                    They must already have a PulseIQ account.
                  </p>
                </div>

                {/* Relationship type (shown if professional role could be both) */}
                <div className="flex gap-2">
                  {(['coach', 'doctor'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRelType(t)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize',
                        relType === t
                          ? 'border-teal-500/60 bg-teal-500/10 text-teal-300'
                          : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-sm text-white/60 block mb-1.5">
                    Message <span className="text-white/30">(optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={2}
                    placeholder="Hi! I'd like to monitor your health data through PulseIQ..."
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/50 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending invitation...' : 'Send invitation'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
