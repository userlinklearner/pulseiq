import { todayISO } from '@/lib/utils'
import { ManualEntryForm } from '@/components/dashboard/ManualEntryForm'
import { createClient } from '@/lib/supabase/server'

export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = todayISO()

  // Last 7 days entries
  const { data: entries } = await supabase
    .from('manual_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(7)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Daily Log</h1>
        <p className="text-white/40 text-sm mt-1">
          How are you feeling today? Log your wellness and training.
        </p>
      </div>

      <ManualEntryForm date={today} />

      {entries && entries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Recent Entries</h2>
          {entries.map(e => (
            <div
              key={e.id}
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {new Date(e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                  {e.mood      && <span>😊 {e.mood}/10</span>}
                  {e.energy    && <span>⚡ {e.energy}/10</span>}
                  {e.soreness  && <span>💪 sore {e.soreness}/10</span>}
                  {e.activity_type && (
                    <span className="text-white/60">
                      {e.activity_type} {e.duration_mins ? `${e.duration_mins}min` : ''} {e.rpe ? `RPE ${e.rpe}` : ''}
                    </span>
                  )}
                </div>
                {e.notes && <p className="text-xs text-white/30 mt-1 truncate max-w-xs">{e.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
