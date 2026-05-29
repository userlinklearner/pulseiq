'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Profile } from '@/types'

const SPORTS = ['Triathlon', 'Running', 'Cycling', 'Swimming', 'CrossFit', 'Strength', 'Team Sports', 'Other']
const GOALS  = ['Lose weight', 'Build endurance', 'Get faster', 'Build strength', 'Stay healthy', 'Race preparation', 'Reduce stress']

export function ProfileForm({ profile, email }: { profile: Profile | null; email: string }) {
  const [name,      setName]      = useState(profile?.display_name ?? '')
  const [birthYear, setBirthYear] = useState(profile?.birth_year?.toString() ?? '')
  const [sport,     setSport]     = useState(profile?.primary_sport ?? '')
  const [goal,      setGoal]      = useState(profile?.goal ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').upsert({
      id:            user.id,
      display_name:  name,
      birth_year:    birthYear ? parseInt(birthYear) : null,
      primary_sport: sport || null,
      goal:          goal || null,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Your Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Email</label>
          <p className="text-sm text-white/60 bg-white/5 border border-white/10 rounded-lg px-3 py-2">{email}</p>
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Display name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Birth year</label>
          <input
            type="number"
            value={birthYear}
            onChange={e => setBirthYear(e.target.value)}
            placeholder="1997"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-2">Primary sport</label>
          <div className="flex flex-wrap gap-1.5">
            {SPORTS.map(s => (
              <button
                key={s}
                onClick={() => setSport(sport === s ? '' : s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sport === s
                    ? 'bg-violet-500/40 text-violet-200 border border-violet-500/50'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-2">Main goal</label>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map(g => (
              <button
                key={g}
                onClick={() => setGoal(goal === g ? '' : g)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  goal === g
                    ? 'bg-indigo-500/40 text-indigo-200 border border-indigo-500/50'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
              >{g}</button>
            ))}
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant={saved ? 'success' : 'default'}
          className="w-full"
        >
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save profile'}
        </Button>
      </CardContent>
    </Card>
  )
}
