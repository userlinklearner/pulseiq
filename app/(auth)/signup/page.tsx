'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Zap, User, Stethoscope, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLES = [
  { key: 'athlete', label: 'Athlete',  desc: 'Track my own training & health', icon: User },
  { key: 'coach',   label: 'Coach',    desc: 'Monitor & guide my athletes',    icon: Dumbbell },
  { key: 'doctor',  label: 'Doctor',   desc: 'Track my patients\' health data', icon: Stethoscope },
]

const DOCTOR_SPECIALTIES = [
  'Sports Medicine', 'Cardiology', 'Orthopedics', 'Physical Therapy',
  'Nutrition', 'Endocrinology', 'General Practice', 'Other',
]

const COACH_SPECIALTIES = [
  'Triathlon', 'Running', 'Cycling', 'Swimming', 'Strength & Conditioning',
  'CrossFit', 'Team Sports', 'General Fitness',
]

export default function SignupPage() {
  const [step,        setStep]        = useState(1)
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [role,        setRole]        = useState('athlete')
  const [specialty,   setSpecialty]   = useState('')
  const [credentials, setCredentials] = useState('')
  const [bio,         setBio]         = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const router = useRouter()

  const isPro       = role !== 'athlete'
  const totalSteps  = isPro ? 3 : 2
  const isLastStep  = step === totalSteps

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (step < totalSteps) { setStep(s => s + 1); return }
    handleSubmit()
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Write role + professional fields to profile
    if (data.user) {
      await supabase.from('profiles').upsert({
        id:           data.user.id,
        display_name: name,
        role,
        specialty:    specialty   || null,
        credentials:  credentials || null,
        bio:          bio         || null,
      })
    }

    router.push(isPro ? '/patients' : '/connect')
  }

  const specialtyList = role === 'doctor' ? DOCTOR_SPECIALTIES : COACH_SPECIALTIES

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#030712]">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-white/40 text-sm mt-1">
            {step === 1 ? 'Free to start. No credit card required.' :
             step === 2 ? 'Who are you on PulseIQ?' :
             'Set up your professional profile.'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s, idx, arr) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step >= s ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/30'
              )}>{s}</div>
              {idx < arr.length - 1 && (
                <div className={cn('w-8 h-px transition-colors', step > s ? 'bg-violet-500' : 'bg-white/10')} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleNext} className="space-y-4">
          {/* ── Step 1: Basic info ── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Michael"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </>
          )}

          {/* ── Step 2: Role ── */}
          {step === 2 && (
            <div className="space-y-2.5">
              {ROLES.map(({ key, label, desc, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setRole(key)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                    role === key
                      ? 'border-violet-500/60 bg-violet-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                    role === key ? 'bg-violet-500/30' : 'bg-white/10'
                  )}>
                    <Icon className={cn('w-5 h-5', role === key ? 'text-violet-300' : 'text-white/40')} />
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-sm font-semibold', role === key ? 'text-white' : 'text-white/60')}>
                      {label}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                  </div>
                  {role === key && (
                    <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: Professional details ── */}
          {step === 3 && (
            <>
              <div>
                <label className="text-sm text-white/60 block mb-2">
                  {role === 'doctor' ? 'Medical specialty' : 'Coaching specialty'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {specialtyList.map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSpecialty(specialty === s ? '' : s)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        specialty === s
                          ? 'bg-violet-500/40 text-violet-200 border border-violet-500/50'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      )}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">
                  Credentials <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={credentials}
                  onChange={e => setCredentials(e.target.value)}
                  placeholder={role === 'doctor' ? 'e.g. MD, FACC' : 'e.g. CSCS, USAT Level 2'}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">
                  Short bio <span className="text-white/30">(optional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  placeholder="Brief professional summary shown to your patients/athletes..."
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(s => s - 1)}
                className="flex-1"
                disabled={loading}
              >
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating account...' : isLastStep ? 'Create account' : 'Continue'}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-white/30">
          By creating an account you agree to the{' '}
          <Link href="/terms" className="underline hover:text-white/60">Terms</Link> and{' '}
          <Link href="/privacy" className="underline hover:text-white/60">Privacy Policy</Link>.
        </p>

        <p className="text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
