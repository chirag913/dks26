import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/* =======================================================
   Supabase Clients
======================================================= */

// 🔐 ANON client → ONLY for auth (JWT verification)
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 🔐 SERVICE ROLE → ONLY for DB access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SaveBody = {
  api_key?: string
}

/* =======================================================
   POST — Save / Update API Key
======================================================= */
export async function POST(req: Request) {
  try {
    /* ---------- AUTH ---------- */
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jwt = authHeader.replace('Bearer ', '').trim()

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(jwt)

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

    /* ---------- API KEY SANITIZATION ---------- */
    const api_key = body.api_key
      ?.replace(/\s+/g, '')            // remove ALL whitespace
      .replace(/[^\x20-\x7E]/g, '')    // remove invisible unicode

    if (!api_key || api_key.length < 40) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      )
    }

    /* ---------- APPROVED USER OVERRIDE ---------- */
    const { data: approvedRow } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('email', user.email?.toLowerCase() ?? '')
      .maybeSingle()

    const isApproved = Boolean(approvedRow)

    /* ---------- SUBSCRIPTION CHECK ---------- */
    if (!isApproved) {
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('status, end_date')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const isActive =
        subscription &&
        (
          subscription.status === 'active' ||
          (
            subscription.status === 'trial' &&
            subscription.end_date &&
            new Date(subscription.end_date).getTime() > Date.now()
          )
        )

      if (!isActive) {
        return NextResponse.json(
          { error: 'Subscription required to update API key' },
          { status: 403 }
        )
      }
    }

    /* ---------- UPSERT TRADING CONFIG ---------- */
    const { data: existing } = await supabaseAdmin
      .from('trading_configs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from('trading_configs')
        .update({
          api_key,
          daily_lock_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('trading_configs')
        .insert({
          user_id: user.id,
          api_key,
          created_at: new Date().toISOString()
        })

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    /* ---------- AUDIT LOG ---------- */
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'API_KEY_SAVED',
      metadata: {
        source: 'api',
        approved: isApproved
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('SAVE API KEY ERROR:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/* =======================================================
   DELETE — Remove API Key
======================================================= */
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jwt = authHeader.replace('Bearer ', '').trim()

    const { data: authData, error } =
      await supabaseAuth.auth.getUser(jwt)

    if (error || !authData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = authData.user

    const { error: delErr } = await supabaseAdmin
      .from('trading_configs')
      .update({
        api_key: null,
        daily_lock_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'API_KEY_REMOVED',
      metadata: { source: 'api' }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('REMOVE API KEY ERROR:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
