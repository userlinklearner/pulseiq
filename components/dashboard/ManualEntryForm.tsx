'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const ACTIVITY_TYPES = [
  'Running', 'Cycling', 'Swimming', 'Strength', 'Yoga',
  'Walking', 'Hiking', 'Rowing', 'HIIT', 'Other'
]

interface ScoreRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  lowLabel?: string
  highLabel?: string
}

function ScoreRow({ label, value, onChange, lowLabel = 'Low', highLabel = 'High' }: ScoreRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-sm text-white/70">{label}</label>
        <span className={cn(
          'text-sm font-bold tabular-nums w-6 text-right',
          value >= 7 ? 'text-emerald-400' : value >= 4 ? 'text-amber-400' : 'text-red-400'
        )}>{value}</span>
      </div>
      <div className="flex gap-1">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-7 rounded text-xs font-medium transition-colors',
              n <= value
                ? n <= 3 ? 'bg-red-500/60 text-white'
                  : n <= 6 ? 'bg-amber-500/60 text-white'
                  : 'bg-emerald-500/60 text-white'
                : 'bg-white/10 text-white/30 hover:bg-white/20'
            )}
          >{n}</button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-white/25">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

export function ManualEntryForm({ date, onSaved }: { date: string; onSaved?: () => void }) {
  const [mood,       setMood]       = useState(5)
  const [energy,     setEnergy]     = useState(5)
  const [soreness,   setSoreness]   = useState(3)
  const [motivation, setMotivation] = useState(5)
  const [activity,   setActivity]   = useState('')
  const [duration,   setDuration]   = useState('')
  const [rpe,        setRpe]        = useState(5)
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('manual_entries').upsert({
      user_id:       user.id,
      date,
      mood,
      energy,
      soreness,
      motivation,
      activity_type: activity || null,
      duration_mins: duration ? parseInt(duration) : null,
      rpe:           activity ? rpe : null,
      notes:         notes || null,
    }, { onConflict: 'user_id,date' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>How are you feeling?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ScoreRow label="Mood"       value={mood}       onChange={setMood}       lowLabel="Rough" highLabel="Great" />
        <ScoreRow label="Energy"     value={energy}     onChange={setEnergy}     lowLabel="Drained" highLabel="Energized" />
        <ScoreRow label="Soreness"   value={soreness}   onChange={setSoreness}   lowLabel="None" highLabel="Very sore" />
        <ScoreRow label="Motivation" value={motivation} onChange={setMotivation} lowLabel="Low" highLabel="Pumped" />

        {/* Optional training log */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <p className="text-sm text-white/50 font-medium">Training (optional)</p>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Activity type</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setActivity(activity === t ? '' : t)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    activity === t ? 'bg-violet-500/40 text-violet-200 border border-violet-500/50'
                                   : 'bg-white/10 text-white/50 hover:bg-white/20'
                  )}
                >{t}</button>
              ))}
            </div>
          </div>

          {activity && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Duration (min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="45"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">RPE (effort 1-10)</label>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setRpe(n)} className={cn(
                      'flex-1 h-8 rounded text-xs font-bold transition-colors',
                      n === rpe ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/30 hover:bg-white/20'
                    )}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Felt great on the tempo intervals, right knee a bit tight..."
            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          variant={saved ? 'success' : 'default'}
          className="w-full"
        >
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Entry'}
        </Button>
      </CardContent>
    </Card>
  )
}
