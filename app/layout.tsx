import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const description = 'Connect Oura, Whoop, and Garmin. Get deep health insights powered by AI.'

export const metadata: Metadata = {
  metadataBase: new URL('https://pulseiq-psi.vercel.app'),
  title: 'PulseIQ — Your Health, Unified',
  description,
  openGraph: {
    title: 'PulseIQ — Your Health, Unified',
    description,
    siteName: 'PulseIQ',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'PulseIQ — Your Health, Unified',
    description,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-[#030712] text-white antialiased">{children}</body>
    </html>
  )
}
