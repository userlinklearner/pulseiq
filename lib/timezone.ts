import { cookies } from 'next/headers'

export const TZ_COOKIE = 'tz'
const FALLBACK = 'America/Sao_Paulo'

function isValid(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

// The user's IANA time zone, reported by the browser (see TimeZoneCookie).
export async function getTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value
  return tz && isValid(tz) ? tz : FALLBACK
}
