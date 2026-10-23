import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { TimeZoneCookie } from '@/components/layout/TimeZoneCookie'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split('@')[0]
  const role = (profile?.role ?? 'athlete') as 'athlete' | 'coach' | 'doctor'

  return (
    <div className="flex min-h-screen">
      <TimeZoneCookie />
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={name} />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
