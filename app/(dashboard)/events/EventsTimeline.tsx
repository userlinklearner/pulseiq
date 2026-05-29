'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, X, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────
interface LifeEvent {
  id: string
  date: string
  end_date: string | null
  title: string
  category: string
  impacts: string[]
  severity: number | null
  notes: string | null
}

interface DayMetric {
  date: string
  hrv_avg: number | null
  resting_hr: number | null
  recovery_score: number | null
  body_battery_wake: number | null
}

// ─── Config ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'social',    label: 'Social',    emoji: '🎉', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { key: 'travel',    label: 'Travel',    emoji: '✈️', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { key: 'health',    label: 'Health',    emoji: '🏥', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { key: 'work',      label: 'Work',      emoji: '💼', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { key: 'substance', label: 'Substance', emoji: '🍺', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { key: 'nutrition', label: 'Nutrition', emoji: '🥗', color: 'bg-lime-500/20 text-lime-300 border-lime-500/30' },
  { key: 'personal',  label: 'Personal',  emoji: '📅', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
]

const IMPACTS = [
  { key: 'alcohol',          label: 'Alcohol',        emoji: '🍸' },
  { key: 'smoking',          label: 'Smoking',        emoji: '🚬' },
  { key: 'poor_sleep',       label: 'Poor sleep',     emoji: '😴' },
  { key: 'stress',           label: 'High stress',    emoji: '😤' },
  { key: 'physical_demand',  label: 'Physical demand',emoji: '💪' },
  { key: 'diet_change',      label: 'Diet change',    emoji: '🍔' },
  { key: 'medication',       label: 'Medication',     emoji: '💊' },
  { key: 'illness',          label: 'Illness',        emoji: '🤒' },
  { key: 'injury',           label: 'Injury',         emoji: '🩹' },
  { key: 'time_zone',        label: 'Time zone',      emoji: '🌍' },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

// ─── Add Event Modal ──────────────────────────────────────────────────────────
function AddEventModal({ onClose, onAdded }: { onClose: () => void; onAdded: (e: LifeEvent) => void }) {
  const [title,     setTitle]     = useState('')
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState('')
  const [category,  setCategory]  = useState('social')
  const [impacts,   setImpacts]   = useState<string[]>([])
  const [severity,  setSeverity]  = useState(3)
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)

  function toggleImpact(key: string) {
    setImpacts(p => p.includes(key) ? p.filter(i => i !== key) : [...p, key])
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('life_events').insert({
      user_id:  user.id,
      title:    title.trim(),
      date,
      end_date: endDate || null,
      category,
      impacts,
      severity,
      notes:    notes || null,
    }).select().single()

    if (data) { onAdded(data as LifeEvent); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d0d14] border border-white/15 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Log a life event</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs text-white/40 block mb-1.5">What happened?</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Steph's wedding, Vegas trip, work deadline..."
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/40" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">End date <span className="text-white/20">(optional)</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/40" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-white/40 block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCategory(c.key)} type="button"
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    category === c.key ? c.color : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10')}>
                  <span>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Impacts */}
          <div>
            <label className="text-xs text-white/40 block mb-2">Health impacts <span className="text-white/20">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {IMPACTS.map(i => (
                <button key={i.key} onClick={() => toggleImpact(i.key)} type="button"
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    impacts.includes(i.key)
                      ? 'bg-orange-500/30 text-orange-200 border border-orange-500/40'
                      : 'bg-white/5 text-white/40 hover:bg-white/10')}>
                  <span>{i.emoji}</span>{i.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs text-white/40 block mb-2">Impact severity — {severity}/5</label>
            <input type="range" min={1} max={5} value={severity} onChange={e => setSeverity(+e.target.value)}
              className="w-full accent-violet-500" />
            <div className="flex justify-between text-xs text-white/20 mt-1">
              <span>Minor</span><span>Major</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Notes <span className="text-white/20">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any details worth remembering..."
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving...' : 'Log event'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Timeline ────────────────────────────────────────────────────────────
export function EventsTimeline({ events: initialEvents, metrics }: {
  events: LifeEvent[]
  metrics: DayMetric[]
}) {
  const [events, setEvents]   = useState(initialEvents)
  const [showAdd, setShowAdd] = useState(false)

  function handleAdded(e: LifeEvent) { setEvents(p => [e, ...p]) }

  // Build a quick lookup of metrics by date
  const metricByDate = Object.fromEntries(metrics.map(m => [m.date, m]))

  // Group events by month
  const byMonth: Record<string, LifeEvent[]> = {}
  for (const e of events) {
    const month = e.date.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(e)
  }

  function getHrvImpact(event: LifeEvent): { delta: number | null; label: string } {
    const dayMetric    = metricByDate[event.date]
    const dayAfter     = metricByDate[new Date(new Date(event.date).getTime() + 86400000).toISOString().split('T')[0]]
    const twoDaysAfter = metricByDate[new Date(new Date(event.date).getTime() + 172800000).toISOString().split('T')[0]]
    const baselineDays = metrics.filter(m => m.date < event.date && m.hrv_avg).slice(-7)
    if (!baselineDays.length) return { delta: null, label: '' }
    const baseline = baselineDays.reduce((s, m) => s + (m.hrv_avg ?? 0), 0) / baselineDays.length
    const postHrv   = (dayAfter?.hrv_avg ?? dayMetric?.hrv_avg ?? twoDaysAfter?.hrv_avg) ?? null
    if (!postHrv) return { delta: null, label: '' }
    const delta = Math.round(postHrv - baseline)
    return { delta, label: `HRV ${delta > 0 ? '+' : ''}${delta}ms vs baseline` }
  }

  return (
    <div className="space-y-5">
      <Button onClick={() => setShowAdd(true)} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Log an event
      </Button>

      {events.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-white/50 font-medium mb-1">No events logged yet</p>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Log parties, travel, stress, illness — anything that might explain patterns in your health data.
          </p>
        </div>
      )}

      {Object.entries(byMonth).map(([month, monthEvents]) => (
        <div key={month}>
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
            {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-2">
            {monthEvents.map(event => {
              const cat    = CAT_MAP[event.category]
              const impact = getHrvImpact(event)

              return (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                        'bg-white/5 border border-white/10'
                      )}>
                        {cat?.emoji ?? '📅'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white text-sm">{event.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-white/30">
                                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {event.end_date && ` → ${new Date(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                              </span>
                              <Badge variant="default" className={cn('capitalize text-xs', cat?.color)}>
                                {cat?.emoji} {cat?.label ?? event.category}
                              </Badge>
                              {event.severity && (
                                <span className="text-xs text-white/30">severity {event.severity}/5</span>
                              )}
                            </div>
                          </div>

                          {/* HRV impact */}
                          {impact.delta !== null && (
                            <div className={cn(
                              'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium',
                              impact.delta < -5 ? 'bg-red-500/10 border-red-500/20 text-red-400'
                              : impact.delta > 5 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-white/40'
                            )}>
                              {impact.delta < -5 ? <TrendingDown className="w-3 h-3" />
                               : impact.delta > 5 ? <TrendingUp className="w-3 h-3" />
                               : <Minus className="w-3 h-3" />}
                              {impact.label}
                            </div>
                          )}
                        </div>

                        {/* Impacts */}
                        {event.impacts?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {event.impacts.map(imp => {
                              const impObj = IMPACTS.find(i => i.key === imp)
                              return impObj ? (
                                <span key={imp} className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300/70 border border-orange-500/20">
                                  {impObj.emoji} {impObj.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}

                        {event.notes && (
                          <p className="text-xs text-white/30 mt-2 leading-relaxed">{event.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {showAdd && <AddEventModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </div>
  )
}
