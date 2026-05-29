'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import { Button }      from '@/components/ui/button'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  token:     string
  accepting: 'professional' | 'athlete'
}

export function AcceptForm({ token, accepting }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const router = useRouter()

  async function handleAccept() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/invites/accept', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }
    router.push(data.redirect ?? '/dashboard')
  }

  function handleDecline() {
    router.push('/dashboard')
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
          {error}
        </p>
      )}

      <Button
        onClick={handleAccept}
        disabled={loading}
        className="w-full flex items-center gap-2 justify-center"
      >
        <CheckCircle2 className="w-4 h-4" />
        {loading
          ? 'Accepting...'
          : accepting === 'professional'
            ? 'Accept — connect with this athlete'
            : 'Accept — grant data access'}
      </Button>

      <button
        onClick={handleDecline}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-sm text-white/30 hover:text-white/50 transition-colors py-2"
      >
        <XCircle className="w-4 h-4" />
        Decline
      </button>

      {accepting === 'athlete' && (
        <p className="text-[11px] text-white/20 text-center">
          You can adjust exactly what they can see or remove them anytime in Settings → Care Team.
        </p>
      )}
    </div>
  )
}
