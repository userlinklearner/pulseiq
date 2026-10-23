'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, X, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, todayISO } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Exam {
  id: string
  exam_date: string
  title: string
  exam_type: string
  provider: string | null
  notes: string | null
}

interface Biomarker {
  id: string
  exam_id: string
  name: string
  value: number
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  flag: string | null
}

// ─── Config ───────────────────────────────────────────────────────────────────
const EXAM_TYPES = [
  { key: 'blood_work',        label: 'Blood Work',         emoji: '🩸' },
  { key: 'vo2max',            label: 'VO2max Test',         emoji: '🫁' },
  { key: 'body_composition',  label: 'Body Composition',    emoji: '⚖️' },
  { key: 'ecg',               label: 'ECG / Heart',         emoji: '❤️' },
  { key: 'dexa',              label: 'DEXA Scan',           emoji: '🦴' },
  { key: 'imaging',           label: 'Imaging / MRI',       emoji: '🧲' },
  { key: 'other',             label: 'Other',               emoji: '📋' },
]

const COMMON_BIOMARKERS: Record<string, Array<{ name: string; unit: string; refLow: number; refHigh: number }>> = {
  blood_work: [
    { name: 'Ferritin',       unit: 'ng/mL', refLow: 20,  refHigh: 250 },
    { name: 'Hemoglobin',     unit: 'g/dL',  refLow: 13.5,refHigh: 17.5 },
    { name: 'Hematocrit',     unit: '%',     refLow: 41,  refHigh: 53 },
    { name: 'Testosterone',   unit: 'ng/dL', refLow: 300, refHigh: 1000 },
    { name: 'Cortisol',       unit: 'μg/dL', refLow: 6,   refHigh: 23 },
    { name: 'Vitamin D',      unit: 'ng/mL', refLow: 30,  refHigh: 80 },
    { name: 'HbA1c',          unit: '%',     refLow: 4.5, refHigh: 5.6 },
    { name: 'Total Cholesterol', unit: 'mg/dL', refLow: 0, refHigh: 200 },
    { name: 'LDL',            unit: 'mg/dL', refLow: 0,   refHigh: 100 },
    { name: 'HDL',            unit: 'mg/dL', refLow: 40,  refHigh: 999 },
    { name: 'Triglycerides',  unit: 'mg/dL', refLow: 0,   refHigh: 150 },
    { name: 'CRP',            unit: 'mg/L',  refLow: 0,   refHigh: 3 },
    { name: 'Magnesium',      unit: 'mg/dL', refLow: 1.7, refHigh: 2.2 },
    { name: 'Zinc',           unit: 'μg/dL', refLow: 60,  refHigh: 120 },
  ],
  vo2max: [
    { name: 'VO2max',         unit: 'mL/kg/min', refLow: 40, refHigh: 65 },
    { name: 'Lactate Threshold HR', unit: 'bpm', refLow: 140, refHigh: 180 },
    { name: 'Max HR',         unit: 'bpm', refLow: 160, refHigh: 200 },
  ],
  body_composition: [
    { name: 'Body Fat %',     unit: '%',   refLow: 6,  refHigh: 24 },
    { name: 'Lean Mass',      unit: 'kg',  refLow: 50, refHigh: 90 },
    { name: 'Bone Density',   unit: 'g/cm²', refLow: 1.0, refHigh: 1.5 },
    { name: 'BMI',            unit: 'kg/m²', refLow: 18.5, refHigh: 25 },
  ],
}

const FLAG_CONFIG: Record<string, { label: string; color: string }> = {
  normal:        { label: 'Normal',        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  low:           { label: 'Low',           color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  high:          { label: 'High',          color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  critical_low:  { label: 'Critical Low',  color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  critical_high: { label: 'Critical High', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// ─── Add Exam Modal ────────────────────────────────────────────────────────────
function AddExamModal({ onClose, onAdded }: {
  onClose: () => void
  onAdded: (exam: Exam, biomarkers: Biomarker[]) => void
}) {
  const [title,    setTitle]    = useState('')
  const [date,     setDate]     = useState(todayISO())
  const [examType, setExamType] = useState('blood_work')
  const [provider, setProvider] = useState('')
  const [notes,    setNotes]    = useState('')
  const [rows,     setRows]     = useState<Array<{ name: string; value: string; unit: string; refLow: string; refHigh: string }>>(
    COMMON_BIOMARKERS.blood_work.slice(0, 5).map(b => ({ name: b.name, value: '', unit: b.unit, refLow: String(b.refLow), refHigh: String(b.refHigh) }))
  )
  const [saving, setSaving] = useState(false)

  function onTypeChange(t: string) {
    setExamType(t)
    const defaults = COMMON_BIOMARKERS[t] ?? []
    setRows(defaults.slice(0, 6).map(b => ({ name: b.name, value: '', unit: b.unit, refLow: String(b.refLow), refHigh: String(b.refHigh) })))
  }

  function addRow() {
    setRows(r => [...r, { name: '', value: '', unit: '', refLow: '', refHigh: '' }])
  }

  function updateRow(i: number, field: string, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: exam } = await supabase.from('medical_exams').insert({
      user_id:   user.id,
      exam_date: date,
      title:     title.trim(),
      exam_type: examType,
      provider:  provider || null,
      notes:     notes || null,
    }).select().single()

    if (!exam) { setSaving(false); return }

    const validRows = rows.filter(r => r.name && r.value && !isNaN(+r.value))
    let insertedBiomarkers: Biomarker[] = []

    if (validRows.length) {
      const { data: bio } = await supabase.from('biomarker_values').insert(
        validRows.map(r => ({
          exam_id:  exam.id,
          user_id:  user.id,
          name:     r.name,
          value:    +r.value,
          unit:     r.unit || null,
          ref_low:  r.refLow  ? +r.refLow  : null,
          ref_high: r.refHigh ? +r.refHigh : null,
        }))
      ).select()
      insertedBiomarkers = (bio ?? []) as Biomarker[]
    }

    onAdded(exam as Exam, insertedBiomarkers)
    onClose()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0d0d14] border border-white/15 rounded-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Add exam results</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Exam type */}
          <div>
            <label className="text-xs text-white/40 block mb-2">Exam type</label>
            <div className="flex flex-wrap gap-2">
              {EXAM_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => onTypeChange(t.key)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    examType === t.key ? 'bg-violet-500/30 text-violet-200 border-violet-500/40' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                  )}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title + date + provider */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Annual blood panel"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/40" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Provider / Lab <span className="text-white/20">(optional)</span></label>
            <input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Dr. Smith / LabCorp"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40" />
          </div>

          {/* Biomarker rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/40">Results</label>
              <button onClick={addRow} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add row
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-12 gap-1.5 text-xs text-white/30 px-1">
                <span className="col-span-4">Name</span>
                <span className="col-span-2">Value</span>
                <span className="col-span-2">Unit</span>
                <span className="col-span-2">Ref low</span>
                <span className="col-span-2">Ref high</span>
              </div>
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <input value={row.name}    onChange={e => updateRow(i, 'name',    e.target.value)} placeholder="Ferritin"
                    className="col-span-4 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                  <input value={row.value}   onChange={e => updateRow(i, 'value',   e.target.value)} placeholder="42" type="number"
                    className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                  <input value={row.unit}    onChange={e => updateRow(i, 'unit',    e.target.value)} placeholder="ng/mL"
                    className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                  <input value={row.refLow}  onChange={e => updateRow(i, 'refLow',  e.target.value)} placeholder="20" type="number"
                    className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                  <input value={row.refHigh} onChange={e => updateRow(i, 'refHigh', e.target.value)} placeholder="250" type="number"
                    className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Doctor's comments, recommendations..."
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving...' : 'Save exam'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Exam Card ────────────────────────────────────────────────────────────────
function ExamCard({ exam, biomarkers, allExams, allBiomarkers }: {
  exam: Exam
  biomarkers: Biomarker[]
  allExams: Exam[]
  allBiomarkers: Biomarker[]
}) {
  const [expanded, setExpanded] = useState(false)
  const typeConf = EXAM_TYPES.find(t => t.key === exam.exam_type)
  const flags = biomarkers.filter(b => b.flag && b.flag !== 'normal')

  return (
    <Card className={cn(flags.length > 0 && 'border-amber-500/20')}>
      <CardContent className="p-4">
        <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
              {typeConf?.emoji ?? '📋'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-white text-sm">{exam.title}</p>
                {expanded ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-white/40">
                  {new Date(exam.exam_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {exam.provider && <span className="text-xs text-white/30">· {exam.provider}</span>}
                <Badge variant="default" className="text-xs">{typeConf?.label ?? exam.exam_type}</Badge>
                {flags.length > 0 && <Badge variant="warning">{flags.length} flag{flags.length > 1 ? 's' : ''}</Badge>}
              </div>
            </div>
          </div>
        </button>

        {expanded && biomarkers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="space-y-1.5">
              {biomarkers.map(b => {
                const flagConf = b.flag ? FLAG_CONFIG[b.flag] : null
                // Find historical values for this biomarker
                const history = allBiomarkers
                  .filter(ab => ab.name === b.name && ab.exam_id !== exam.id)
                  .map(ab => ({ value: ab.value, date: allExams.find(e => e.id === ab.exam_id)?.exam_date ?? '' }))
                  .filter(h => h.date)
                  .sort((a, z) => a.date.localeCompare(z.date))
                const prev = history[history.length - 1]
                const trend = prev ? b.value - prev.value : null

                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="text-sm text-white/70 flex-1">{b.name}</span>
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {b.value} <span className="text-white/30 text-xs">{b.unit}</span>
                    </span>
                    {b.ref_low && b.ref_high && (
                      <span className="text-xs text-white/25">
                        [{b.ref_low}–{b.ref_high}]
                      </span>
                    )}
                    {flagConf && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', flagConf.color)}>
                        {flagConf.label}
                      </span>
                    )}
                    {trend !== null && (
                      <span className={cn('flex items-center gap-0.5 text-xs',
                        trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-white/30')}>
                        {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {trend > 0 ? '+' : ''}{trend.toFixed(1)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {exam.notes && (
              <p className="mt-3 text-xs text-white/40 italic leading-relaxed">{exam.notes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Biomarker Trends ─────────────────────────────────────────────────────────
function BiomarkerTrends({ exams, biomarkers }: { exams: Exam[]; biomarkers: Biomarker[] }) {
  const tracked = [...new Set(biomarkers.map(b => b.name))].filter(name => {
    const vals = biomarkers.filter(b => b.name === name)
    return vals.length >= 2
  })

  if (!tracked.length) return null

  return (
    <Card>
      <CardHeader><CardTitle>Biomarker trends over time</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {tracked.map(name => {
          const vals = biomarkers
            .filter(b => b.name === name)
            .map(b => ({ value: b.value, date: exams.find(e => e.id === b.exam_id)?.exam_date ?? '', flag: b.flag, unit: b.unit }))
            .filter(v => v.date)
            .sort((a, z) => a.date.localeCompare(z.date))

          const latest = vals[vals.length - 1]
          const first  = vals[0]
          const delta  = latest.value - first.value
          const flagConf = latest.flag ? FLAG_CONFIG[latest.flag] : FLAG_CONFIG.normal

          return (
            <div key={name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{name}</p>
                <p className="text-xs text-white/30">{vals.length} measurements</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {vals.map((v, i) => (
                    <div key={i} className="text-center">
                      <div className="w-12 h-6 flex items-center justify-center">
                        <div className={cn('h-1.5 rounded-full', i === vals.length - 1 ? 'w-12' : 'w-8')}
                          style={{
                            background: v.flag === 'normal' ? '#10b981' :
                                        v.flag === 'low' || v.flag === 'high' ? '#f59e0b' : '#ef4444'
                          }} />
                      </div>
                      <p className="text-xs text-white/40 tabular-nums">{v.value}</p>
                    </div>
                  ))}
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-sm font-bold text-white">{latest.value} <span className="text-xs text-white/30">{latest.unit}</span></p>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded border', flagConf.color)}>{flagConf.label}</span>
                </div>
                {delta !== 0 && (
                  <span className={cn('text-xs font-medium min-w-[40px] text-right',
                    delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ExamsView({ exams: initialExams, biomarkers: initialBiomarkers }: {
  exams: Exam[]
  biomarkers: Biomarker[]
}) {
  const [exams,      setExams]      = useState(initialExams)
  const [biomarkers, setBiomarkers] = useState(initialBiomarkers)
  const [showAdd,    setShowAdd]    = useState(false)

  function handleAdded(exam: Exam, newBio: Biomarker[]) {
    setExams(e => [exam, ...e])
    setBiomarkers(b => [...b, ...newBio])
  }

  const criticalFlags = biomarkers.filter(b => b.flag === 'critical_low' || b.flag === 'critical_high')

  return (
    <div className="space-y-5">
      <Button onClick={() => setShowAdd(true)} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Add exam results
      </Button>

      {/* Critical flags alert */}
      {criticalFlags.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-400">Critical values flagged</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              {criticalFlags.map(f => `${f.name} (${f.value} ${f.unit ?? ''})`).join(', ')} — consult your doctor.
            </p>
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🩸</p>
          <p className="text-white/50 font-medium mb-1">No exams added yet</p>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Add your blood work, VO2max tests, and other results. Your coach will reference them in analysis.
          </p>
        </div>
      ) : (
        <>
          <BiomarkerTrends exams={exams} biomarkers={biomarkers} />
          <div className="space-y-3">
            {exams.map(exam => (
              <ExamCard
                key={exam.id}
                exam={exam}
                biomarkers={biomarkers.filter(b => b.exam_id === exam.id)}
                allExams={exams}
                allBiomarkers={biomarkers}
              />
            ))}
          </div>
        </>
      )}

      {showAdd && <AddExamModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </div>
  )
}
