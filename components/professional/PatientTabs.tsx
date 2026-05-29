'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Tab { key: string; label: string; show?: boolean }

interface Props {
  tabs: Tab[]
  activeTab: string
}

export function PatientTabs({ tabs, activeTab }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const visible = tabs.filter(t => t.show !== false)

  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
      {visible.map(tab => (
        <button
          key={tab.key}
          onClick={() => router.push(`${pathname}?tab=${tab.key}`)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === tab.key
              ? 'bg-teal-500/20 text-teal-200 border border-teal-500/30'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
