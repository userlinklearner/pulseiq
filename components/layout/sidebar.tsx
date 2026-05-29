'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, PlusSquare, BarChart2,
  Settings, Zap, Link2, MessageCircle, Users, Dumbbell,
  Calendar, FlaskConical, UserRound,
} from 'lucide-react'

// ── Athlete nav ──────────────────────────────────────
const ATHLETE_FREE = [
  { href: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/history',   label: 'History',     icon: BarChart2       },
  { href: '/log',       label: 'Log Entry',   icon: PlusSquare      },
  { href: '/events',    label: 'Life Events', icon: Calendar        },
  { href: '/exams',     label: 'Exams',       icon: FlaskConical    },
  { href: '/connect',   label: 'Devices',     icon: Link2           },
  { href: '/settings',  label: 'Settings',    icon: Settings        },
]

const ATHLETE_PAID = [
  { href: '/coach',     label: 'Coach',       icon: MessageCircle,  badge: '✦' },
  { href: '/community', label: 'Community',   icon: Users           },
  { href: '/plan',      label: 'My Plan',     icon: Dumbbell        },
]

// ── Professional nav ─────────────────────────────────
const PRO_NAV = [
  { href: '/patients',  label: 'Patients',    icon: UserRound       },
  { href: '/community', label: 'Community',   icon: Users           },
  { href: '/settings',  label: 'Settings',    icon: Settings        },
]

interface Props {
  role?: 'athlete' | 'coach' | 'doctor'
}

export function Sidebar({ role = 'athlete' }: Props) {
  const pathname   = usePathname()
  const isPro      = role === 'coach' || role === 'doctor'

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const NavLink = ({ href, label, icon: Icon, badge }: {
    href: string; label: string; icon: React.ElementType; badge?: string
  }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          active
            ? isPro
              ? 'bg-teal-500/20 text-teal-200'
              : 'bg-white/10 text-white'
            : isPro
              ? 'text-white/50 hover:text-white/80 hover:bg-teal-500/10'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge && <span className="text-violet-400/60 text-xs">{badge}</span>}
      </Link>
    )
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-black/40 border-r border-white/10 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">PulseIQ</span>
        {isPro && (
          <span className={cn(
            'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider',
            role === 'doctor'
              ? 'bg-teal-500/20 text-teal-400'
              : 'bg-sky-500/20 text-sky-400'
          )}>
            {role}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {isPro ? (
          <>
            {PRO_NAV.map(item => <NavLink key={item.href} {...item} />)}
          </>
        ) : (
          <>
            {ATHLETE_FREE.map(item => <NavLink key={item.href} {...item} />)}

            {/* Coach section */}
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">Coach</p>
            </div>

            {ATHLETE_PAID.map(({ href, label, icon: Icon, badge }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-violet-500/20 text-violet-200'
                      : 'text-white/50 hover:text-white/80 hover:bg-violet-500/10'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge && <span className="text-violet-400/60 text-xs">{badge}</span>}
                </Link>
              )
            })}

            {/* Care team link in settings area */}
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">Team</p>
            </div>
            <NavLink href="/settings/team" label="Care Team" icon={UserRound} />
          </>
        )}
      </nav>

      {/* Bottom: today's date */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-white/30 font-mono">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </aside>
  )
}
