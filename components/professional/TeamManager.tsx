'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/professional/CopyButton'
import { cn } from '@/lib/utils'
import {
  UserRound, Stethoscope, Dumbbell, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Shield, UserPlus,
} from 'lucide-react'

interface Profile {
  id:          string
  display_name: string | null
  role:         string
  specialty:    string | null
  credentials:  string | null
  bio:          string | null
}

interface Relationship {
  id:                  string
  professional_id:     string
  athlete_id:          string
  relationship_type:   string
  status:              string
  invite_token:        string
  invited_at:          string
  accepted_at:         string | null
  message:             string | null
  can_view_metrics:    boolean
  can_view_activities: boolean
  can_view_exams:      boolean
  can_view_events:     boolean
  can_view_manual:     boolean
  can_add_exams:       boolean
  can_add_notes:       boolean
  can_create_plans:    boolean
  professional:        Profile | null
}

interface Props {
  relationships: Relationship[]
  athleteId:     string
}

const PERMISSIONS = [
  { key: 'can_view_metrics',    label: 'View metrics',    desc: 'HRV, sleep, recovery scores' },
  { key: 'can_view_activities', label: 'View activities', desc: 'Workouts and training sessions' },
  { key: 'can_view_exams',      label: 'View exams',      desc: 'Blood work and medical tests' },
  { key: 'can_view_events',     label: 'View life events',desc: 'Stress, travel, social events' },
  { key: 'can_view_manual',     label: 'View wellness log',desc: 'Mood, energy, RPE entries' },
  { key: 'can_add_exams',       label: 'Add exam results',desc: 'Upload your medical tests' },
  { key: 'can_add_notes',       label: 'Add notes',       desc: 'Leave coaching / clinical notes' },
  { key: 'can_create_plans',    label: 'Create plans',    desc: 'Build training plans for you' },
]

export function TeamManager({ relationships, athleteId }: Props) {
  const [rels,       setRels]       = useState<Relationship[]>(relationships)
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail,   setInvEmail]   = useState('')
  const [invType,    setInvType]    = useState<'coach' | 'doctor'>('coach')
  const [invMsg,     setInvMsg]     = useState('')
  const [invLoading, setInvLoading] = useState(false)
  const [invResult,  setInvResult]  = useState<string | null>(null)
  const [invError,   setInvError]   = useState('')
  const [saving,     setSaving]     = useState<string | null>(null)

  const active  = rels.filter(r => r.status === 'active')
  const pending = rels.filter(r => r.status === 'pending')
  const revoked = rels.filter(r => r.status === 'revoked')

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInvLoading(true)
    setInvError('')

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:             invEmail,
        relationship_type: invType,
        message:           invMsg,
        invited_as:        'athlete',   // athlete is sending this invite
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setInvError(data.error ?? 'Something went wrong')
      setInvLoading(false)
      return
    }
    setInvResult(data.invite_url)
    // Reload relationships
    const newRel: Relationship = {
      ...data.relationship,
      professional: null,
    }
    setRels(prev => [newRel, ...prev])
    setInvLoading(false)
  }

  async function updatePermission(relId: string, key: string, value: boolean) {
    setSaving(relId)
    await fetch('/api/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationship_id: relId, [key]: value }),
    })
    setRels(prev =>
      prev.map(r => r.id === relId ? { ...r, [key]: value } : r)
    )
    setSaving(null)
  }

  async function revokeAccess(relId: string) {
    if (!confirm('Revoke this professional\'s access to your data?')) return
    setSaving(relId)
    await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationship_id: relId }),
    })
    setRels(prev =>
      prev.map(r => r.id === relId ? { ...r, status: 'revoked' } : r)
    )
    setSaving(null)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="space-y-6">

      {/* ── Active professionals ── */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Active ({active.length})
          </h2>
          {active.map(rel => (
            <RelCard
              key={rel.id}
              rel={rel}
              saving={saving === rel.id}
              onUpdatePermission={(key, val) => updatePermission(rel.id, key, val)}
              onRevoke={() => revokeAccess(rel.id)}
            />
          ))}
        </section>
      )}

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Pending ({pending.length})
          </h2>
          {pending.map(rel => (
            <div key={rel.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white capitalize">
                  {rel.relationship_type} invitation pending
                </p>
                <p className="text-xs text-white/30 mt-0.5 truncate font-mono">
                  {`${appUrl}/accept?token=${rel.invite_token}`}
                </p>
              </div>
              <CopyButton value={`${appUrl}/accept?token=${rel.invite_token}`} />
              <button
                onClick={() => revokeAccess(rel.id)}
                className="text-white/20 hover:text-red-400 transition-colors ml-1"
                title="Cancel invite"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ── Invite new professional ── */}
      <section className="space-y-3">
        <button
          onClick={() => { setShowInvite(!showInvite); setInvResult(null); setInvError('') }}
          className="flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add a doctor or coach
          {showInvite
            ? <ChevronUp className="w-3.5 h-3.5 ml-1" />
            : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>

        {showInvite && (
          <Card>
            <CardContent className="p-5">
              {invResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-white">Invitation created! Share this link:</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={invResult}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/60 focus:outline-none"
                    />
                    <CopyButton value={invResult} />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => { setShowInvite(false); setInvResult(null); setInvEmail(''); setInvMsg('') }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={sendInvite} className="space-y-4">
                  <p className="text-sm text-white/50">
                    Enter their PulseIQ email. They&apos;ll get a link to confirm access.
                  </p>

                  <div className="flex gap-2">
                    {(['coach', 'doctor'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setInvType(t)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                          invType === t
                            ? 'border-violet-500/60 bg-violet-500/10 text-violet-300'
                            : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                        )}
                      >
                        {t === 'doctor'
                          ? <Stethoscope className="w-4 h-4" />
                          : <Dumbbell className="w-4 h-4" />}
                        <span className="capitalize">{t}</span>
                      </button>
                    ))}
                  </div>

                  <input
                    type="email"
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    required
                    placeholder={invType === 'doctor' ? 'doctor@clinic.com' : 'coach@training.com'}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                  />
                  <textarea
                    value={invMsg}
                    onChange={e => setInvMsg(e.target.value)}
                    rows={2}
                    placeholder="Optional message..."
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 resize-none"
                  />

                  {invError && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {invError}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={invLoading}>
                    {invLoading ? 'Sending...' : 'Send invite'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Revoked (collapsed) ── */}
      {revoked.length > 0 && (
        <p className="text-xs text-white/20">
          {revoked.length} revoked relationship{revoked.length !== 1 ? 's' : ''} hidden
        </p>
      )}

      {/* ── Empty state ── */}
      {rels.length === 0 && !showInvite && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Shield className="w-8 h-8 text-white/20 mx-auto" />
            <p className="text-white/50 text-sm">No professionals connected yet.</p>
            <p className="text-white/30 text-xs">
              Invite your doctor or coach to view your health data and collaborate on your training.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Individual relationship card with permission toggles ──

function RelCard({ rel, saving, onUpdatePermission, onRevoke }: {
  rel:                 Relationship
  saving:              boolean
  onUpdatePermission:  (key: string, val: boolean) => void
  onRevoke:            () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const pro = rel.professional
  const roleIcon = rel.relationship_type === 'doctor'
    ? <Stethoscope className="w-4 h-4 text-teal-400" />
    : <Dumbbell className="w-4 h-4 text-sky-400" />

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          {roleIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {pro?.display_name ?? 'Unknown professional'}
            </p>
            <Badge variant={rel.relationship_type === 'doctor' ? 'info' : 'success'} className="capitalize">
              {rel.relationship_type}
            </Badge>
          </div>
          <p className="text-xs text-white/40">
            {[pro?.specialty, pro?.credentials].filter(Boolean).join(' · ') || 'No specialty set'}
            {rel.accepted_at && (
              <span className="ml-2 text-white/20">
                · Since {new Date(rel.accepted_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <div className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </div>

      {/* Permissions panel */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {pro?.bio && (
            <p className="text-xs text-white/40 italic">&ldquo;{pro.bio}&rdquo;</p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Permissions</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {PERMISSIONS.map(({ key, label, desc }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(rel as unknown as Record<string, boolean>)[key]}
                    onChange={e => onUpdatePermission(key, e.target.checked)}
                    className="mt-0.5 accent-violet-500"
                  />
                  <div>
                    <p className="text-xs font-medium text-white">{label}</p>
                    <p className="text-[11px] text-white/30">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={onRevoke}
              className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Revoke access
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
