'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MessageSquare, Users } from 'lucide-react'

const TABS = [
  { key: 'forum',   label: 'Forum',   icon: MessageSquare },
  { key: 'stories', label: 'Stories', icon: Users },
]

export function Tabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit border border-white/10">
      {TABS.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={`/community?tab=${key}`}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            active === key
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </div>
  )
}
