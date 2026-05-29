'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Pin, Plus, X, Lock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const NOTE_TYPES = [
  { key: 'general',        label: 'General',        color: 'bg-white/10 text-white/50' },
  { key: 'medical',        label: 'Medical',        color: 'bg-rose-500/20 text-rose-400' },
  { key: 'coaching',       label: 'Coaching',       color: 'bg-sky-500/20 text-sky-400' },
  { key: 'recommendation', label: 'Recommendation', color: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'concern',        label: 'Concern',        color: 'bg-amber-500/20 text-amber-400' },
  { key: 'flag',           label: 'Flag',           color: 'bg-red-500/20 text-red-400' },
  { key: 'exam_note',      label: 'Exam Note',      color: 'bg-violet-500/20 text-violet-400' },
]

const typeColor = (type: string) =>
  NOTE_TYPES.find(t => t.key === type)?.color ?? 'bg-white/10 text-white/50'

interface Note {
  id:              string
  note_type:       string
  title:           string | null
  body:            string
  is_private:      boolean
  pinned:          boolean
  created_at:      string
  updated_at:      string
}

interface Props {
  athleteId:      string
  professionalId: string
  canAdd:         boolean
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function ProfessionalNotes({ athleteId, professionalId, canAdd }: Props) {
  const [notes,    setNotes]    = useState<Note[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)

  // form fields
  const [noteType,  setNoteType]  = useState('general')
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [pinned,    setPinned]    = useState(false)
  const [saving,    setSaving]    = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchNotes()
  }, [athleteId, professionalId])

  async function fetchNotes() {
    setLoading(true)
    const { data } = await supabase
      .from('professional_notes')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('athlete_id', athleteId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotes((data ?? []) as Note[])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)

    const { data, error } = await supabase
      .from('professional_notes')
      .insert({
        professional_id: professionalId,
        athlete_id:      athleteId,
        note_type:       noteType,
        title:           title.trim() || null,
        body:            body.trim(),
        is_private:      isPrivate,
        pinned,
      })
      .select()
      .single()

    if (!error && data) {
      setNotes(prev => [data as Note, ...prev.filter(n => !n.pinned), ...prev.filter(n => n.pinned)])
      setBody('')
      setTitle('')
      setNoteType('general')
      setIsPrivate(false)
      setPinned(false)
      setShowForm(false)
      fetchNotes() // re-sort properly
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('professional_notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function togglePin(note: Note) {
    await supabase
      .from('professional_notes')
      .update({ pinned: !note.pinned })
      .eq('id', note.id)
    fetchNotes()
  }

  return (
    <div className="space-y-4">
      {/* Add note button */}
      {canAdd && !showForm && (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add note
        </Button>
      )}

      {/* Note form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New note</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Note type pills */}
          <div className="flex flex-wrap gap-1.5">
            {NOTE_TYPES.map(t => (
              <button
                type="button"
                key={t.key}
                onClick={() => setNoteType(t.key)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  noteType === t.key
                    ? `${t.color} border-current`
                    : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/50"
            />
          </div>
          <div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              rows={4}
              placeholder="Write your note here..."
              className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-white/50 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private (only you see this)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={e => setPinned(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-white/50 flex items-center gap-1">
                <Pin className="w-3 h-3" /> Pin to top
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !body.trim()} className="flex-1">
              {saving ? 'Saving...' : 'Save note'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">
          No notes yet. {canAdd ? 'Add your first note above.' : ''}
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={() => handleDelete(note.id)}
              onTogglePin={() => togglePin(note)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── NoteCard ─────────────────────────────────────────

function NoteCard({ note, onDelete, onTogglePin }: {
  note:         Note
  onDelete:     () => void
  onTogglePin:  () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = note.body.length > 300
  const display = isLong && !expanded ? note.body.slice(0, 300) + '…' : note.body

  return (
    <div className={cn(
      'p-4 rounded-xl border bg-white/5 transition-all',
      note.pinned ? 'border-amber-500/30' : 'border-white/10'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {note.pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', typeColor(note.note_type))}>
              {NOTE_TYPES.find(t => t.key === note.note_type)?.label ?? note.note_type}
            </span>
            {note.is_private && (
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
            <span className="text-[11px] text-white/20 ml-auto">
              {timeAgo(note.created_at)}
            </span>
          </div>

          {/* Title */}
          {note.title && (
            <p className="text-sm font-semibold text-white">{note.title}</p>
          )}

          {/* Body */}
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{display}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Read more</>
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={onTogglePin}
            title={note.pinned ? 'Unpin' : 'Pin'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              note.pinned
                ? 'text-amber-400 bg-amber-500/20'
                : 'text-white/20 hover:text-amber-400 hover:bg-amber-500/10'
            )}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete note"
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
