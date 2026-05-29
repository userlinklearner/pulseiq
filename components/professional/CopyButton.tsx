'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors flex-shrink-0"
    >
      {copied ? (
        <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
      ) : (
        <><Copy className="w-3 h-3 text-white/40" /><span className="text-white/40">Copy link</span></>
      )}
    </button>
  )
}
