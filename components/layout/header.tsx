'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, Zap, LayoutDashboard, BarChart2, PlusSquare, Link2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history',   label: 'History',   icon: BarChart2 },
  { href: '/log',       label: 'Log Entry', icon: PlusSquare },
  { href: '/connect',   label: 'Devices',   icon: Link2 },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function Header({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-black/60 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold">PulseIQ</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-white/60 hover:text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile nav drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav className="absolute top-14 left-0 right-0 bg-black/90 border-b border-white/10 p-4 space-y-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                    active ? 'bg-white/10 text-white' : 'text-white/50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Desktop top bar */}
      <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-white/10">
        <p className="text-sm text-white/40">
          Welcome back{userName ? `, ${userName}` : ''}
        </p>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-white/40 hover:text-white gap-2">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </>
  )
}
