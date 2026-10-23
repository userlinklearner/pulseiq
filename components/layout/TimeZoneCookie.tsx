'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Reports the browser's time zone to the server so "today" matches the user's calendar.
export function TimeZoneCookie() {
  const router = useRouter()
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const current = document.cookie.split('; ').find(c => c.startsWith('tz='))?.slice(3)
    if (tz && decodeURIComponent(current ?? '') !== tz) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    }
  }, [router])
  return null
}
