// app/api/subscription/check-status/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Secure server-side check-status route.
 * Expects Authorization: Bearer <api_key> header (user access token).
 * Uses a service_role key to run RPCs and query DB safely.
 */

export async function GET(req: Request) {
  try {
    // PUBLIC client to validate the user token and get user info
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // ADMIN client using service_role key to run RPCs and DB writes/reads
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Read auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    // Validate token and get user
    const { data: userData, error: userError } = await publicClient.auth.getUser(token)
    if (userError || !userData?.user) {
      console.error('Authentication error:', userError?.message ?? userError)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    const user = userData.user

    // 1) Run server-side expiration / locking logic for this user
    //    (RPC must exist: check_and_expire_user_subscriptions(uid uuid))
    try {
      await adminClient.rpc('check_and_expire_user_subscriptions', { uid: user.id })
    } catch (rpcErr) {
      // don't fail the whole request on RPC problems — log and continue
      console.warn('RPC check_and_expire_user_subscriptions warning:', rpcErr)
    }

    // 2) Fetch most recent subscription for this user
    const { data: subsData, error: subErr } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subErr && subErr.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subErr)
      return NextResponse.json({ error: 'Error checking subscription status' }, { status: 500 })
    }

    const subscription = (Array.isArray(subsData) && subsData.length > 0) ? subsData[0] : null

    // 3) Fetch trading_configs to determine locked state
    const { data: tcfgData, error: tcfgErr } = await adminClient
      .from('trading_configs')
      .select('id, user_id, api_key, locked_until, auto_trading_enabled')
      .eq('user_id', user.id)
      .limit(1)

    if (tcfgErr && tcfgErr.code !== 'PGRST116') {
      console.error('Error fetching trading_configs:', tcfgErr)
      return NextResponse.json({ error: 'Error fetching trading configuration' }, { status: 500 })
    }

    const tradingConfig = (Array.isArray(tcfgData) && tcfgData.length > 0) ? tcfgData[0] : null

    // 4) Compute status + seconds left
    const now = new Date()
    let endDate: string | null = null
    let secondsLeft = null as number | null
    let status: 'no-subscription' | 'trial-active' | 'trial-expired' | 'active' | 'expired' = 'no-subscription'

    if (subscription) {
      endDate = subscription.end_date ? new Date(subscription.end_date).toISOString() : null
      if (endDate) {
        secondsLeft = Math.floor((new Date(endDate).getTime() - now.getTime()) / 1000)
      } else {
        secondsLeft = null
      }

      // Determine subscription status
      const sStatus = (subscription.status ?? '').toLowerCase()
      if (sStatus === 'trial') {
        status = (secondsLeft !== null && secondsLeft > 0) ? 'trial-active' : 'trial-expired'
      } else if (sStatus === 'active') {
        status = (secondsLeft !== null && secondsLeft > 0) ? 'active' : 'expired'
      } else if (sStatus === 'expired' || (secondsLeft !== null && secondsLeft <= 0)) {
        status = 'expired'
      } else {
        // fallback: use database status string if it's something else
        status = sStatus as any || 'no-subscription'
      }
    } else {
      status = 'no-subscription'
      secondsLeft = null
    }

    // 5) Decide whether user can edit/add API key (SERVER AUTHORITATIVE)
let canEditApi =
  status === 'active' ||
  status === 'trial-active'

// lock override
if (tradingConfig?.locked_until) {
  const lockedUntil = new Date(tradingConfig.locked_until)
  if (lockedUntil.getTime() > now.getTime()) {
    canEditApi = false
  }
}

    // Response payload ready for the client sidebar UI
    return NextResponse.json({
      now: now.toISOString(),
      subscription,
      trading_config: tradingConfig,
      seconds_left: secondsLeft,
      end_date: endDate,
      status,
      can_edit_api: canEditApi
    })
  } catch (error: any) {
    console.error('Error in check-status route:', error)
    return NextResponse.json({
      error: 'Error checking subscription status',
      details: error?.message ?? String(error)
    }, { status: 500 })
  }
}
