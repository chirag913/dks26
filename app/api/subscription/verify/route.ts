// app/api/subscription/verify/route.ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_CONFIG, calculateAmounts } from '@/config/subscription'

export async function POST(req: Request) {
  try {
    const body: any = await req.json()
    const razorpay_payment_id: string | undefined = body.razorpay_payment_id
    const razorpay_subscription_id: string | undefined = body.razorpay_subscription_id
    const razorpay_signature: string | undefined = body.razorpay_signature
    const fallbackUserId: string | undefined = body.user_id

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment parameters' }, { status: 400 })
    }

    const razorSecret = process.env.RAZORPAY_KEY_SECRET
    if (!razorSecret) {
      console.error('RAZORPAY_KEY_SECRET missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // verify HMAC signature: HMAC_SHA256(payment_id + '|' + subscription_id, secret)
    const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`
    const expected = crypto.createHmac('sha256', razorSecret).update(payload).digest('hex')

    if (expected !== razorpay_signature) {
      console.warn('Invalid Razorpay signature', { expected, provided: razorpay_signature })
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // AUTH: Prefer Authorization header with access token
    const authHeader = req.headers.get('authorization') || ''
    let userId: string | null = null

    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const { data, error } = await anonSupabase.auth.getUser(token)
        if (!error && data.user) userId = data.user.id
        else console.warn('Token did not yield a user:', error?.message ?? '')
      } catch (e) {
        console.warn('Error validating bearer token:', (e as any)?.message ?? e)
      }
    }

    if (!userId && fallbackUserId) {
      console.warn('No bearer token provided — using provided user_id from body (less secure).')
      userId = fallbackUserId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required (provide Authorization Bearer token)' }, { status: 401 })
    }

    // Use service-role client for writes
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Get amounts
    const { totalInPaise } = calculateAmounts()

    const nowISO = new Date().toISOString()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    const endDateISO = endDate.toISOString()

    // Upsert subscription — use razorpay_subscription_id (must be UNIQUE in DB)
    const subscriptionRow = {
      user_id: userId,
      status: 'active',
      plan_type: 'premium',
      start_date: nowISO,
      end_date: endDateISO,
      total_amount: totalInPaise,
      currency: SUBSCRIPTION_CONFIG.CURRENCY || 'INR',
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_customer_id: null,
      is_trial: false,
      created_at: nowISO,
      updated_at: nowISO
    }

    const { error: upsertError } = await admin
      .from('subscriptions')
      .upsert([subscriptionRow], { onConflict: 'razorpay_subscription_id' })

    if (upsertError) {
      console.error('Failed to upsert subscription:', upsertError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Insert payment record using transaction_id for Razorpay payment id
    try {
      const paymentRow = {
        transaction_id: razorpay_payment_id,
        subscription_id: razorpay_subscription_id,
        user_id: userId,
        amount: totalInPaise,
        currency: SUBSCRIPTION_CONFIG.CURRENCY || 'INR',
        status: 'paid',
        created_at: nowISO
      }

      const { error: payErr } = await admin
        .from('payments')
        .upsert([paymentRow], { onConflict: 'transaction_id' })
      if (payErr) {
        console.debug('payments table upsert error (ignored):', payErr.message ?? payErr)
      }
    } catch (e) {
      console.debug('Skipping payments insert (table may be missing):', e)
    }

    return NextResponse.json({ success: true, message: 'Subscription verified and stored', razorpay_subscription_id })
  } catch (err: any) {
    console.error('Verify route error:', err)
    return NextResponse.json({ error: 'Server error', details: err?.message ?? String(err) }, { status: 500 })
  }
}
