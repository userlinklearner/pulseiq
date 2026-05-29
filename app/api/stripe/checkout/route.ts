import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = await createCheckoutSession(
      user.id,
      user.email!,
      process.env.NEXT_PUBLIC_STRIPE_COACH_PRICE_ID!,
      `${process.env.NEXT_PUBLIC_APP_URL}/coach?upgraded=true`,
      `${process.env.NEXT_PUBLIC_APP_URL}/coach?canceled=true`
    )
    return NextResponse.json({ url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
