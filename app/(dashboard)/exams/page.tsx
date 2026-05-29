import { createClient } from '@/lib/supabase/server'
import { ExamsView } from './ExamsView'

export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [examsRes, biomarkersRes] = await Promise.all([
    supabase
      .from('medical_exams')
      .select('*')
      .eq('user_id', user.id)
      .order('exam_date', { ascending: false }),
    supabase
      .from('biomarker_values')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Health Exams</h1>
        <p className="text-white/40 text-sm mt-1">
          Blood work, VO2max tests, body composition, and any medical results.
          Your coach can reference these in analysis.
        </p>
      </div>
      <ExamsView exams={examsRes.data ?? []} biomarkers={biomarkersRes.data ?? []} />
    </div>
  )
}
