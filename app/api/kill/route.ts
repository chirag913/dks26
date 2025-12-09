// app/api/kill/route.ts
import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import getDhanClientFactory from '@/lib/dhanServer'
import { cancelAndExitCleanly } from '@/helpers/exitHelpers'
import { performCompleteKill } from '@/helpers/killHelpers'

type KillRequestBody = {
  pnl?: number
  orders?: number
  reason?: string
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any })

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr) {
      console.error('Supabase getSession error:', sessionErr)
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 })
    }
    const session = sessionData.session
    if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const user = session.user

    let body: KillRequestBody = {}
    try {
      body = (await req.json()) as KillRequestBody
    } catch (e) {
      body = {}
    }

    const { data: cfgData, error: cfgErr } = await supabase
      .from('trading_configs')
      .select('api_key, locked_until')
      .eq('user_id', user.id)
      .maybeSingle()

    if (cfgErr) {
      console.error('Error reading trading_configs:', cfgErr)
      return NextResponse.json({ error: 'DB error reading config' }, { status: 500 })
    }

    const apiKey = cfgData?.api_key
    if (!apiKey) return NextResponse.json({ error: 'No Dhan API key saved for user' }, { status: 400 })

    const createDhanClient = getDhanClientFactory()
    const dhan = createDhanClient(apiKey)

    const results: any = {}

    try {
      const cancelExit = await cancelAndExitCleanly(dhan, {
        cancelThrottleMs: 150,
        cancelSettleMs: 3000,
        confirmPollMs: 800,
        confirmTimeoutMs: 10000
      })
      results.cancelExit = cancelExit
    } catch (e: any) {
      console.warn('cancelAndExitCleanly failed:', e)
      results.cancelExit = { ok: false, error: String(e?.message ?? e) }
    }

    try {
      const { final, trace } = await performCompleteKill(dhan, {
        pauseMs: 2000,
        retryFinal: 5,
        backoffMs: 500
      })
      results.killFinal = final
      results.killTrace = trace
    } catch (e: any) {
      console.warn('performCompleteKill failed:', e)
      results.killFinal = null
      results.killTrace = { ok: false, error: String(e?.message ?? e) }
    }

    try {
      const logRow = {
        user_id: user.id,
        action_type: 'KILL_SWITCH_TRIGGERED_SERVER',
        action_details: { body, results },
        pnl: body.pnl ?? null,
        orders_count: body.orders ?? null,
        kill_switch_status: Boolean(results.killFinal),
        created_at: new Date().toISOString()
      }
      await supabase.from('trading_logs').insert([logRow])

      await supabase.from('kill_switch_logs').insert([{
        user_id: user.id,
        trigger_reason: body.reason ?? 'MANUAL_SERVER',
        pnl_at_trigger: body.pnl ?? null,
        orders_at_trigger: body.orders ?? null,
        results,
        created_at: new Date().toISOString()
      }])
    } catch (e: any) {
      console.warn('Failed to write logs:', e)
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    console.error('POST /api/kill error:', err)
    return NextResponse.json({ error: 'Server error', details: err?.message ?? String(err) }, { status: 500 })
  }
}
