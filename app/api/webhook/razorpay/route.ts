// app/api/webhook/razorpay/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { SUBSCRIPTION_CONFIG } from '@/config/subscription'

export async function POST(req: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error('Missing RAZORPAY_WEBHOOK_SECRET env')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''
    if (!signature) {
      console.warn('Missing X-Razorpay-Signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    if (expected !== signature) {
      console.warn('Invalid webhook signature', { expected, signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload: any = JSON.parse(rawBody)
    const event = payload.event
    const data = payload.payload ?? {}
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const mapUserIdFromNotes = (obj: any): string | null => {
      // If you include user_id in Razorpay "notes" when creating subscription/checkout, it will be here
      try {
        if (!obj) return null
        if (obj.notes && obj.notes.user_id) return obj.notes.user_id
        // sometimes notes may be nested
        if (obj.entity?.notes && obj.entity.notes.user_id) return obj.entity.notes.user_id
      } catch (e) {
        // ignore
      }
      return null
    }

    const upsertSubscription = async (subEntity: any) => {
      if (!subEntity?.id) return
      const subId = subEntity.id
      const startDateISO = subEntity.start_at ? new Date(Number(subEntity.start_at) * 1000).toISOString() : new Date().toISOString()
      const endISO = subEntity.current_end ? new Date(Number(subEntity.current_end) * 1000).toISOString() : null
      const notesUser = mapUserIdFromNotes(subEntity) || mapUserIdFromNotes(subEntity.entity) || null

      const row = {
        // do NOT set `id` if your subscriptions.id is UUID
        user_id: notesUser,
        status: subEntity.status ?? 'active',
        plan_type: 'premium',
        start_date: startDateISO,
        end_date: endISO,
        total_amount: null,
        currency: SUBSCRIPTION_CONFIG.CURRENCY || 'INR',
        razorpay_subscription_id: subId,
        razorpay_customer_id: subEntity.customer_id ?? null,
        updated_at: new Date().toISOString()
      }

      const { error } = await admin.from('subscriptions').upsert([row], { onConflict: 'razorpay_subscription_id' })
      if (error) console.error('Failed to upsert subscription row', error)
    }

    const upsertPayment = async (paymentEntity: any) => {
      if (!paymentEntity?.id) return
      const payId = paymentEntity.id
      const createdISO = paymentEntity.created_at ? new Date(Number(paymentEntity.created_at) * 1000).toISOString() : new Date().toISOString()
      const notesUser = mapUserIdFromNotes(paymentEntity) || mapUserIdFromNotes(paymentEntity.entity) || null

      const row = {
        // use transaction_id column for razorpay id (payments.id should remain uuid)
        transaction_id: payId,
        subscription_id: paymentEntity.subscription_id ?? null,
        user_id: notesUser,
        amount: paymentEntity.amount ?? (paymentEntity.total ?? 0),
        currency: paymentEntity.currency ?? 'INR',
        status: paymentEntity.status ?? 'paid',
        created_at: createdISO
      }

      const { error } = await admin.from('payments').upsert([row], { onConflict: 'transaction_id' })
      if (error) console.error('Failed to upsert payment row', error)
    }

    // Handle events
    switch (event) {
      case 'payment.captured': {
        const entity = data.payment?.entity
        await upsertPayment(entity)
        break
      }

      case 'subscription.charged':
      case 'subscription.charged_successfully':
      case 'invoice.paid': {
        const paymentEntity = data.payment?.entity
        const subscriptionEntity = data.subscription?.entity
        if (paymentEntity) await upsertPayment(paymentEntity)
        if (subscriptionEntity) await upsertSubscription(subscriptionEntity)
        break
      }

      case 'subscription.created': {
        const subscriptionEntity = data.subscription?.entity
        if (subscriptionEntity) await upsertSubscription(subscriptionEntity)
        break
      }

      case 'subscription.activated':
      case 'subscription.cancelled':
      case 'subscription.paused': {
        const subscriptionEntity = data.subscription?.entity
        if (subscriptionEntity) await upsertSubscription(subscriptionEntity)
        break
      }

      default: {
        // optional: store webhook for auditing if you have a table
        try {
          const rawRow = {
            id: `rzpb_${Date.now()}`,
            event,
            payload,
            created_at: new Date().toISOString()
          }
          await admin.from('webhook_audit').insert([rawRow])
        } catch (e) {
          // ignore if audit table missing
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Server error', details: err?.message ?? String(err) }, { status: 500 })
  }
}
