// app/api/trading-config/save/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SaveBody = {
  api_key?: string
}

export async function POST(req: Request) {
  try {
    /* ---------- AUTH ---------- */
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jwt = auth.replace('Bearer ', '').trim()
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt)

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = authData.user

    /* ---------- BODY ---------- */
    let body: SaveBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const api_key = body.api_key?.trim()
    if (!api_key) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }

    /* ---------- APPROVED USER OVERRIDE ---------- */
    const { data: approvedRow } = await supabase
      .from('approved_users')
      .select('email')
      .eq('email', user.email?.toLowerCase() ?? '')
      .maybeSingle()

    const isApproved = Boolean(approvedRow)

    /* ---------- SUBSCRIPTION CHECK ---------- */
    if (!isApproved) {
      const nowIso = new Date().toISOString()

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, end_date')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const isActive =
        subscription &&
        (subscription.status === 'active' ||
          (subscription.status === 'trial' &&
            subscription.end_date &&
            subscription.end_date > nowIso))

      if (!isActive) {
        return NextResponse.json(
          { error: 'Subscription required to update API key' },
          { status: 403 }
        )
      }
    }

    /* ---------- UPSERT CONFIG ---------- */
    const { data: existing } = await supabase
      .from('trading_configs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('trading_configs')
        .update({
          api_key,          // 🔒 encrypt here later
          daily_lock_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    } else {
      const { error: insErr } = await supabase
        .from('trading_configs')
        .insert({
          user_id: user.id,
          api_key,          // 🔒 encrypt here later
          created_at: new Date().toISOString()
        })

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    /* ---------- AUDIT LOG ---------- */
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'API_KEY_SAVED',
      metadata: {
        source: 'api',
        approved: isApproved
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
