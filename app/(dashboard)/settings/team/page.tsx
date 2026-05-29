import { createClient } from '@/lib/supabase/server'
import { TeamManager }  from '@/components/professional/TeamManager'

export default async function CareTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all relationships where current user is the athlete
  const { data: rels } = await supabase
    .from('professional_relationships')
    .select('*')
    .eq('athlete_id', user.id)
    .order('invited_at', { ascending: false })

  // Fetch professional profiles for active relationships
  const relationships = rels ?? []
  const proIds = relationships.map(r => r.professional_id)

  const { data: proProfiles } = proIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, role, specialty, credentials, bio')
        .in('id', proIds)
    : { data: [] }

  const profileMap = Object.fromEntries(
    (proProfiles ?? []).map(p => [p.id, p])
  )

  // Merge profile data into relationships
  const enriched = relationships.map(r => ({
    ...r,
    professional: profileMap[r.professional_id] ?? null,
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Care Team</h1>
        <p className="text-white/40 text-sm mt-1">
          Manage which doctors and coaches can access your health data.
        </p>
      </div>
      <TeamManager relationships={enriched} athleteId={user.id} />
    </div>
  )
}
