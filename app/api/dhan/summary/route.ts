import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    // ---------------- INTERNAL CRON CHECK ----------------
    const internalSecret = req.headers.get('x-internal-cron')
    const isInternalCall =
      internalSecret === process.env.INTERNAL_CRON_SECRET

    let userId: string | null = null

    // ---------------- UI CALL (COOKIE BASED) ----------------
    if (!isInternalCall) {
      const cookieStore = await cookies()

      const supabaseAuth = createServerComponentClient({
        cookies: () => cookieStore
      })

      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'UNAUTHENTICATED' },
          { status: 401 }
        )
      }

      userId = user.id
    }

    // ---------------- CRON CALL ----------------
    if (isInternalCall) {
      userId = req.headers.get('x-user-id')
      if (!userId) {
        return NextResponse.json(
          { error: 'user_id missing for cron' },
          { status: 400 }
        )
      }
    }

    // ---------------- FETCH API KEY ----------------
    const { data: cfg, error } = await supabaseAdmin
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', userId)
      .single()

    if (error || !cfg?.api_key) {
      // UI → error, Cron → silent zero
      if (!isInternalCall) {
        return NextResponse.json(
          { error: 'API key not found' },
          { status: 401 }
        )
      }
      return NextResponse.json({ pnl: 0, orders: 0 })
    }

    const token = cfg.api_key

    // ---------------- FETCH POSITIONS ----------------
    const posRes = await fetch('https://api.dhan.co/v2/positions', {
      headers: { 'access-token': token }
    })

    if (!posRes.ok) {
      if (!isInternalCall) {
        return NextResponse.json(
          { error: 'Dhan auth failed' },
          { status: 401 }
        )
      }
      return NextResponse.json({ pnl: 0, orders: 0 })
    }

    const pos = await posRes.json()

    // ---------------- FETCH ORDERS ----------------
    const ordRes = await fetch('https://api.dhan.co/v2/orders', {
      headers: { 'access-token': token }
    })

    const ord = ordRes.ok ? await ordRes.json() : []

    // ---------------- CALCULATIONS ----------------
    const pnl = Array.isArray(pos)
      ? pos.reduce(
          (sum: number, p: any) =>
            sum +
            Number(p.realizedProfit ?? 0) +
            Number(p.unrealizedProfit ?? 0),
          0
        )
      : 0

    const orders = Array.isArray(ord)
      ? ord.filter(
          (o: any) =>
            String(o.orderStatus).toUpperCase() === 'TRADED'
        ).length
      : 0

    return NextResponse.json({ pnl, orders })
  } catch (e) {
    console.error('[dhan/summary]', e)
    return NextResponse.json(
      { error: 'SUMMARY_FAILED' },
      { status: 500 }
    )
  }
}
