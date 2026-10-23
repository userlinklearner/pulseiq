import Link from 'next/link'

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">← PulseIQ</Link>
        <h1 className="text-3xl font-bold mt-6 mb-2">{title}</h1>
        <p className="text-white/40 text-sm mb-10">Last updated {updated}</p>
        <div className="space-y-6 text-white/70 leading-relaxed [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-10 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </div>
  )
}
