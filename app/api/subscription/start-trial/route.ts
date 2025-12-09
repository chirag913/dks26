// app/api/subscription/start-trial/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id

    // Prevent creating overlapping trials/subscriptions
    const { data: subsRows, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subsErr && (subsErr as any).code !== 'PGRST116') {
      console.error('Error fetching subscriptions (start-trial):', subsErr)
      return NextResponse.json({ error: 'Failed to check existing subscriptions' }, { status: 500 })
    }

    const latest = Array.isArray(subsRows) && subsRows.length ? subsRows[0] : null
    const now = new Date()
    if (latest) {
      const end = latest.end_date ? new Date(latest.end_date).getTime() : 0
      if (end > now.getTime() && (latest.status === 'trial' || latest.status === 'active')) {
        return NextResponse.json({ error: 'You already have an active subscription or trial' }, { status: 409 })
      }
    }

    // create trial subscription for 7 days
    const startDateISO = new Date().toISOString()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 7)
    const endDateISO = endDate.toISOString()

    // create an id (you can also let DB generate via default)
    const id = uuidv4()

    const subRow = {
      id,
      user_id: userId,
      status: 'trial',
      plan_type: 'premium',
      start_date: startDateISO,
      end_date: endDateISO,
      is_trial: true,
      total_amount: 0,
      gst_amount: 0,
      created_at: startDateISO,
      updated_at: startDateISO
    }

    const { error: insertErr } = await supabaseAdmin
      .from('subscriptions')
      .insert([subRow])

    if (insertErr) {
      console.error('Error creating trial subscription:', insertErr)
      return NextResponse.json({ error: 'Failed to create trial' }, { status: 500 })
    }

    // success
    return NextResponse.json({ ok: true, subscription: subRow })
  } catch (err: any) {
    console.error('start-trial error', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
