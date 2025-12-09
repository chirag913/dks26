// app/api/subscription/create/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { SUBSCRIPTION_CONFIG } from '@/config/subscription'

/**
 * POST /api/subscription/create
 * - Expects Authorization: Bearer <access_token> (preferred).
 * - Reuses an existing plan_id stored in `billing_config` (recommended).
 * - If plan is missing, creates one and stores plan_id in billing_config.
 * - Creates a subscription for the authenticated user and returns subscriptionId & key_id.
 */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

type CreateResponse = {
  subscriptionId: string
  amount_rupees: number
  amount_in_paise: number
  currency: string
  baseAmount: number
  gstAmount: number
  key_id?: string | null
}

export async function POST(req: Request) {
  try {
    // basic env checks
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase public env vars missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // parse and validate auth
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization Bearer token required' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    // validate token & get user with anon client
    const anonSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: userData, error: userError } = await anonSupabase.auth.getUser(token)
    if (userError || !userData.user) {
      console.warn('Invalid token when creating subscription', userError?.message ?? '')
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }
    const user = userData.user

    // service-role client (server-only) for DB reads/writes
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // compute amounts (safe paise arithmetic)
    const baseRupees = Number(SUBSCRIPTION_CONFIG.BASE_AMOUNT ?? 999) // fallback 999
    const gstRate = Number(SUBSCRIPTION_CONFIG.GST_RATE ?? 0.18)
    const baseInPaise = Math.round(baseRupees * 100)
    const gstInPaise = Math.round(baseRupees * gstRate * 100)
    const totalInPaise = baseInPaise + gstInPaise

    // Try to reuse plan_id from billing_config table (safe typed handling)
    let planId: string | null = null
    try {
      const cfgRes = await adminSupabase.from('billing_config').select('plan_id').limit(1).maybeSingle()
      // cfgRes: { data?, error? }
      if (!cfgRes.error && cfgRes.data && (cfgRes.data as any).plan_id) {
        planId = String((cfgRes.data as any).plan_id)
        // verify plan exists on Razorpay; if fetch fails we'll recreate
        try {
          // use non-null assertion because we checked above
          await (razorpay as any).plans.fetch(planId)
        } catch (e) {
          console.warn('Stored plan_id invalid or deleted; will recreate plan.', e)
          planId = null
        }
      }
    } catch (e) {
      console.debug('billing_config lookup failed or empty; will create plan.', e)
      planId = null
    }

    // Create plan if missing (use any to avoid strict SDK type mismatch)
    if (!planId) {
      const planPayload: any = {
        period: 'monthly', // Razorpay accepts 'monthly' literal
        interval: 1,
        item: {
          name: SUBSCRIPTION_CONFIG.PLAN_NAME ?? 'KillSwitch Pro - Monthly',
          amount: totalInPaise, // paise
          currency: SUBSCRIPTION_CONFIG.CURRENCY ?? 'INR',
          description: 'Monthly subscription to KillSwitch Pro Premium'
        },
        notes: {
          base_amount_paise: String(baseInPaise),
          gst_amount_paise: String(gstInPaise)
        }
      }

      const plan: any = await (razorpay as any).plans.create(planPayload)
      if (!plan || !plan.id) {
        console.error('Razorpay plan creation failed', plan)
        return NextResponse.json({ error: 'Payment provider error' }, { status: 500 })
      }
      planId = String(plan.id)

      // Persist plan_id back to billing_config (create or update single-row)
      try {
        const existingCfg = await adminSupabase.from('billing_config').select('id').limit(1).maybeSingle()
        if (!existingCfg.error && existingCfg.data && (existingCfg.data as any).id) {
          await adminSupabase.from('billing_config').update({ plan_id: planId }).eq('id', (existingCfg.data as any).id)
        } else {
          await adminSupabase.from('billing_config').insert({ plan_id: planId })
        }
      } catch (e) {
        console.warn('Failed to persist plan_id to billing_config (non-fatal):', e)
      }
    }

    // planId is guaranteed non-null here; create subscription
    if (!planId) {
      return NextResponse.json({ error: 'Plan creation error' }, { status: 500 })
    }

    const subscriptionPayload: any = {
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      notes: {
        user_id: user.id,
        user_email: user.email ?? ''
      }
    }

    const subscription: any = await (razorpay as any).subscriptions.create(subscriptionPayload)
    if (!subscription || !subscription.id) {
      console.error('Razorpay subscription creation failed', subscription)
      return NextResponse.json({ error: 'Payment provider error' }, { status: 500 })
    }

    const responsePayload: CreateResponse = {
      subscriptionId: String(subscription.id),
      amount_rupees: Math.round(totalInPaise / 100),
      amount_in_paise: totalInPaise,
      currency: SUBSCRIPTION_CONFIG.CURRENCY ?? 'INR',
      baseAmount: baseRupees,
      gstAmount: Math.round(baseRupees * gstRate * 100) / 100,
      key_id: process.env.RAZORPAY_KEY_ID ?? null
    }

    return NextResponse.json(responsePayload)
  } catch (err: any) {
    console.error('Subscription create error:', err)
    return NextResponse.json({ error: 'Server error', details: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST with Authorization header' }, { status: 405 })
}
