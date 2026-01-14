// app/api/dhan/orders/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import getDhanClientFactory from '@/lib/dhanServer'
import { assertKillNotActive } from '@/lib/killGuard'

/* =========================================================
   POST → PLACE ORDER (KILL SWITCH ENFORCED)
========================================================= */
export async function POST(req: Request) {
  const user_id = req.headers.get('x-user-id')

  if (!user_id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 🔥 HARD KILL SWITCH ENFORCEMENT
  try {
    await assertKillNotActive(user_id)
  } catch {
    return NextResponse.json(
      { error: 'Kill switch active. Trading disabled.' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()

    const cookieStore = cookies()
    const supabase = createServerComponentClient({
      cookies: () => cookieStore as any
    })

    const { data: cfg, error: cfgErr } = await supabase
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', user_id)
      .single()

    if (cfgErr || !cfg?.api_key) {
      return NextResponse.json(
        { error: 'Trading API key not configured' },
        { status: 400 }
      )
    }

    const getDhanClient = getDhanClientFactory()
    const dhan = getDhanClient(cfg.api_key)

    // 🔒 SAFE: kill switch already checked
    const orderResult = await dhan.placeOrder(body)

    return NextResponse.json(orderResult)
  } catch (err: any) {
    console.error('POST /api/dhan/orders error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Order failed' },
      { status: 500 }
    )
  }
}

/* =========================================================
   GET → FETCH ORDERS (READ-ONLY, NO KILL REQUIRED)
========================================================= */
export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({
      cookies: () => cookieStore as any
    })

    const { data: userData, error: userErr } =
      await supabase.auth.getUser()

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = userData.user

    const { data: cfg, error: cfgErr } = await supabase
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', user.id)
      .single()

    if (cfgErr || !cfg?.api_key) {
      return NextResponse.json(
        { error: 'Trading API key not configured' },
        { status: 400 }
      )
    }

    const getDhanClient = getDhanClientFactory()
    const dhan = getDhanClient(cfg.api_key)

    const orders = await dhan.getOrders()
    return NextResponse.json(orders)
  } catch (err: any) {
    console.error('GET /api/dhan/orders error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
