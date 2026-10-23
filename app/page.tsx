import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap, Heart, Activity, Moon, TrendingUp, Shield } from 'lucide-react'

const DEVICES = [
  { name: 'Oura Ring',   color: '#6366f1', icon: '💍', desc: 'HRV, sleep stages, readiness' },
  { name: 'Whoop',       color: '#f43f5e', icon: '⌚', desc: 'Recovery, strain, sleep coach' },
  { name: 'Garmin',      color: '#06b6d4', icon: '🏃', desc: 'Activities, GPS, health metrics' },
  { name: 'Manual',      color: '#84cc16', icon: '✍️', desc: 'Log mood, energy, any workout' },
]

const FEATURES = [
  { icon: Moon,       title: 'Sleep Analysis',    desc: 'Deep, REM, and light sleep tracked across every device in one view.' },
  { icon: Heart,      title: 'HRV & Recovery',    desc: 'Know if today is a go-hard day or a rest day before you even start.' },
  { icon: Activity,   title: 'Training Load',     desc: 'All your workouts unified — running, cycling, swimming, strength.' },
  { icon: TrendingUp, title: 'Long-Term Trends',  desc: 'See your fitness trajectory over months and years, not just today.' },
  { icon: Shield,     title: 'Stress & Wellness', desc: 'Body battery, stress scores, and subjective wellbeing in one place.' },
  { icon: Zap,        title: 'AI Coach',          desc: 'Coaching based on YOUR actual data, not generic advice. Not medical advice.', pro: true },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">PulseIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-8">
          <Zap className="w-3 h-3" />
          Connect Oura, Whoop & Garmin in minutes
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Every health signal.<br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            One dashboard.
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
          PulseIQ connects all your wearables and health data into a single intelligent view.
          Understand your sleep, recovery, training load, and long-term trends like never before.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Button size="lg" asChild>
            <Link href="/signup">Start for free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">I have an account</Link>
          </Button>
        </div>
      </section>

      {/* Device logos */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <p className="text-center text-white/30 text-sm mb-8">Works with</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DEVICES.map(d => (
            <div
              key={d.name}
              className="flex flex-col items-center gap-2 p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
            >
              <span className="text-3xl">{d.icon}</span>
              <p className="font-semibold text-white">{d.name}</p>
              <p className="text-xs text-white/40 text-center">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-3">Everything you need to train smarter</h2>
        <p className="text-white/40 text-center mb-12">No more switching between apps. All your data, deeply analyzed.</p>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, pro }) => (
            <div key={title} className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Icon className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                {title}
                {pro && (
                  <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    Pro
                  </span>
                )}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="p-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20">
          <h2 className="text-3xl font-bold mb-3">Start understanding your body today</h2>
          <p className="text-white/50 mb-8">Free to start. No credit card required. Pro features include a 7-day free trial.</p>
          <Button size="lg" asChild className="w-full max-w-xs">
            <Link href="/signup">Create your account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-white/20 text-sm">
        <p>PulseIQ &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
