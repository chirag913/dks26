// app/api/trading-config/save/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Server route to manage trading_configs.api_key for authenticated users.
 * - POST: upsert api_key (requires Authorization: Bearer <access_token>)
 * - DELETE: clear api_key (requires Authorization: Bearer <access_token>)
 *
 * Both endpoints enforce:
 *  - server-side subscription/trial checks
 *  - approved_users override
 *  - trading_configs.locked_until blocking
 *
 * Place this file at: app/api/trading-config/save/route.ts
 */

/* ---------- DELETE: remove API key (clear api_key) ---------- */
export async function DELETE(req: Request) {
  try {
    // Public client to validate access token
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    const { data: userData, error: userErr } = await publicClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id
    const userEmail = userData.user.email?.toLowerCase() ?? ''

    // Best-effort: expire subscriptions server-side first
    try {
      await supabaseAdmin.rpc('check_and_expire_user_subscriptions', { uid: userId })
    } catch (rpcErr) {
      console.warn('RPC check_and_expire_user_subscriptions failed (DELETE):', rpcErr)
    }

    // Fetch latest subscription (if any)
    const { data: subsRows, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subsErr && (subsErr as any).code !== 'PGRST116') {
      console.error('Error fetching subscription for delete', subsErr)
      return NextResponse.json({ error: 'Failed to check subscription' }, { status: 500 })
    }
    const subscription = Array.isArray(subsRows) && subsRows.length ? subsRows[0] : null

    // Check approved_users
    const { data: approvedRows, error: approvedErr } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('email', userEmail)
      .limit(1)

    if (approvedErr && (approvedErr as any).code !== 'PGRST116') {
      console.warn('approved_users query warning (DELETE)', approvedErr)
    }
    const isApproved = Array.isArray(approvedRows) && approvedRows.length > 0

    // Permission logic for removing
    let canRemove = false
    const now = Date.now()
    if (isApproved) canRemove = true
    if (subscription) {
      const end = subscription.end_date ? new Date(subscription.end_date).getTime() : 0
      if ((subscription.status === 'trial' || subscription.status === 'active') && end > now) {
        canRemove = true
      }
    }

    // Check trading_configs.locked_until
    const { data: tcRows, error: tcErr } = await supabaseAdmin
      .from('trading_configs')
      .select('locked_until')
      .eq('user_id', userId)
      .limit(1)

    if (tcErr && (tcErr as any).code !== 'PGRST116') {
      console.warn('Error fetching trading_configs.locked_until (DELETE)', tcErr)
    }
    const tcRow = Array.isArray(tcRows) && tcRows.length ? tcRows[0] : null
    if (tcRow?.locked_until) {
      const lockedUntil = new Date(tcRow.locked_until).getTime()
      if (lockedUntil > now) canRemove = false
    }

    if (!canRemove) {
      return NextResponse.json({ error: 'Subscription required or expired. Cannot remove API key.' }, { status: 403 })
    }

    // Clear api_key (preserve row)
    const { error: updateErr } = await supabaseAdmin
      .from('trading_configs')
      .update({ api_key: '' })
      .eq('user_id', userId)

    if (updateErr) {
      console.error('Error clearing API key', updateErr)
      return NextResponse.json({ error: 'Failed to remove API key' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/trading-config/save error', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

/* ---------- POST: upsert API key ---------- */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const api_key = body?.api_key?.toString()?.trim()
    if (!api_key) return NextResponse.json({ error: 'api_key is required' }, { status: 400 })

    // Public client to validate access token
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    const { data: userData, error: userErr } = await publicClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id
    const userEmail = userData.user.email?.toLowerCase() ?? ''

    // Best-effort: expire subscriptions server-side first
    try {
      await supabaseAdmin.rpc('check_and_expire_user_subscriptions', { uid: userId })
    } catch (rpcErr) {
      console.warn('RPC check_and_expire_user_subscriptions failed (POST):', rpcErr)
    }

    // Fetch most recent subscription (if any)
    const { data: subsRows, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subsErr && (subsErr as any).code !== 'PGRST116') {
      console.error('Error fetching subscription:', subsErr)
      return NextResponse.json({ error: 'Failed to check subscription' }, { status: 500 })
    }

    const subscription = Array.isArray(subsRows) && subsRows.length ? subsRows[0] : null

    // Check approved_users (server-side override)
    const { data: approvedRows, error: approvedErr } = await supabaseAdmin
      .from('approved_users')
      .select('email, created_at')
      .eq('email', userEmail)
      .limit(1)

    if (approvedErr && (approvedErr as any).code !== 'PGRST116') {
      console.warn('approved_users query warning (POST)', approvedErr)
    }
    const isApproved = Array.isArray(approvedRows) && approvedRows.length > 0

    // Determine if user can edit API
    let canEdit = false
    const now = Date.now()
    if (isApproved) canEdit = true

    if (subscription) {
      const end = subscription.end_date ? new Date(subscription.end_date).getTime() : 0
      if ((subscription.status === 'trial' || subscription.status === 'active') && end > now) {
        canEdit = true
      }
    }

    // Check trading_configs.locked_until
    const { data: tcRows, error: tcErr } = await supabaseAdmin
      .from('trading_configs')
      .select('locked_until')
      .eq('user_id', userId)
      .limit(1)

    if (tcErr && (tcErr as any).code !== 'PGRST116') {
      console.warn('Error fetching trading_configs.locked_until (POST)', tcErr)
    }
    const tcRow = Array.isArray(tcRows) && tcRows.length ? tcRows[0] : null
    if (tcRow?.locked_until) {
      const lockedUntil = new Date(tcRow.locked_until).getTime()
      if (lockedUntil > now) canEdit = false
    }

    if (!canEdit) {
      return NextResponse.json({ error: 'Subscription required or expired. Please subscribe to enable API management.' }, { status: 403 })
    }

    // Upsert trading_configs row
    const upsertRow = {
      user_id: userId,
      api_key,
      updated_at: new Date().toISOString()
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('trading_configs')
      .upsert(upsertRow, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('Error upserting trading_configs', upsertErr)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('POST /api/trading-config/save error', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
