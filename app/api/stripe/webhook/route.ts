import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  // Use service role for webhook — bypasses RLS, initialized per-request
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const getUserId = (metadata?: Stripe.Metadata | null) => metadata?.supabase_uid

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = getUserId(session.metadata)
      if (!userId || !session.subscription) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const period = (sub as unknown as { current_period_end?: number }).current_period_end
      await supabaseAdmin.from('subscriptions').upsert({
        user_id:             userId,
        stripe_customer_id:  session.customer as string,
        stripe_sub_id:       sub.id,
        plan:                'coach',
        status:              sub.status,
        current_period_end:  period ? new Date(period * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      }, { onConflict: 'user_id' })
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = getUserId(sub.metadata)
      if (!userId) break

      const period = (sub as unknown as { current_period_end?: number }).current_period_end
      const plan = event.type === 'customer.subscription.deleted' ? 'free' : 'coach'
      await supabaseAdmin.from('subscriptions').upsert({
        user_id:             userId,
        stripe_sub_id:       sub.id,
        plan:                sub.status === 'active' || sub.status === 'trialing' ? plan : 'free',
        status:              sub.status,
        current_period_end:  period ? new Date(period * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      }, { onConflict: 'user_id' })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = (invoice as unknown as { subscription?: string }).subscription
      if (!subId) break
      const sub    = await stripe.subscriptions.retrieve(subId)
      const userId = getUserId(sub.metadata)
      if (!userId) break

      await supabaseAdmin.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', userId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
