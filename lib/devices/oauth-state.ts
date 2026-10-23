import { randomBytes, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_PREFIX = 'oauth_state_'
const MAX_AGE_SECS = 600

// Creates a random state value and stores it in an httpOnly cookie on the redirect response.
export function redirectWithState(provider: string, buildUrl: (state: string) => string) {
  const state = randomBytes(24).toString('hex')
  const res = NextResponse.redirect(buildUrl(state))
  res.cookies.set(COOKIE_PREFIX + provider, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/devices',
    maxAge: MAX_AGE_SECS,
  })
  return res
}

// Returns true when the state in the callback URL matches the cookie set at connect time.
export function verifyState(provider: string, request: NextRequest): boolean {
  const expected = request.cookies.get(COOKIE_PREFIX + provider)?.value
  const actual = new URL(request.url).searchParams.get('state')
  if (!expected || !actual || expected.length !== actual.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

export function clearState(provider: string, res: NextResponse) {
  res.cookies.set(COOKIE_PREFIX + provider, '', { path: '/api/devices', maxAge: 0 })
  return res
}
