// app/api/subscription/start-trial/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = userData.user.id

    // Check existing subscription
    const { data: subsRows, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subsErr && (subsErr as any).code !== 'PGRST116') {
      console.error('Error fetching subscriptions:', subsErr)
      return NextResponse.json({ error: 'Failed to check subscriptions' }, { status: 500 })
    }

    const latest = subsRows?.[0]
    const now = Date.now()

    if (latest) {
      const end = latest.end_date ? new Date(latest.end_date).getTime() : 0
      if (end > now && (latest.status === 'trial' || latest.status === 'active')) {
        return NextResponse.json(
          { error: 'You already have an active subscription or trial' },
          { status: 409 }
        )
      }
    }

    // Create 7-day trial
    const startDateISO = new Date().toISOString()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 7)

   const subRow = {
  user_id: userId,
  status: 'trial',
  plan_type: 'premium',
  start_date: startDateISO,
  end_date: endDate.toISOString(),
  is_trial: true,

  // 🔥 REQUIRED BY DB
  amount: 0,

  // existing fields
  total_amount: 0,
  gst_amount: 0,
  currency: 'INR'
}

    const { error: insertErr } = await supabaseAdmin
      .from('subscriptions')
      .insert([subRow])

    if (insertErr) {
      console.error('Error creating trial:', insertErr)
      return NextResponse.json({ error: 'Failed to create trial' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, subscription: subRow })
  } catch (err: any) {
    console.error('🔥 START TRIAL FAILED:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
