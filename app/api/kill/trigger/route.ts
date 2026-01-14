export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

const MAX_ATTEMPTS = 5
const STEP_DELAY_MS = 3000
const RETRY_DELAY_MS = 10000

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const user_id =
      body?.user_id ||
      req.headers.get('x-user-id')

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id missing' },
        { status: 400 }
      )
    }

    /* =====================
       1️⃣ Fetch config
       ===================== */
    const { data: cfg, error: cfgErr } = await supabase
      .from('trading_configs')
      .select('api_key, kill_switch_active')
      .eq('user_id', user_id)
      .single()

    if (cfgErr || !cfg?.api_key) {
      return NextResponse.json(
        { error: 'Invalid trading config' },
        { status: 500 }
      )
    }

    // Idempotency guard
    if (cfg.kill_switch_active) {
      return NextResponse.json({
        ok: true,
        alreadyActive: true
      })
    }

    const headers = { 'access-token': cfg.api_key }
    const ACTIVATE =
      'https://api.dhan.co/v2/killswitch?killSwitchStatus=ACTIVATE'
    const DEACTIVATE =
      'https://api.dhan.co/v2/killswitch?killSwitchStatus=DEACTIVATE'

    /* =====================
       2️⃣ RETRY LOOP
       ===================== */
    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // ACTIVATE (1)
        let res = await fetch(ACTIVATE, { method: 'POST', headers })
        let text = await res.text()
        if (!res.ok) throw new Error(`ACTIVATE-1 failed: ${text}`)

        await sleep(STEP_DELAY_MS)

        // DEACTIVATE
        res = await fetch(DEACTIVATE, { method: 'POST', headers })
        text = await res.text()
        if (!res.ok) throw new Error(`DEACTIVATE failed: ${text}`)

        await sleep(STEP_DELAY_MS)

        // ACTIVATE (FINAL)
        res = await fetch(ACTIVATE, { method: 'POST', headers })
        text = await res.text()
        if (!res.ok) throw new Error(`ACTIVATE-2 failed: ${text}`)

        // ✅ SUCCESS → persist state
        await supabase
          .from('trading_configs')
          .update({
            kill_switch_active: true,
            kill_triggered_at: new Date().toISOString()
          })
          .eq('user_id', user_id)

        return NextResponse.json({
          ok: true,
          attempt,
          message: 'Kill switch locked for the day'
        })

      } catch (err: any) {
        lastError = err.message
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    return NextResponse.json(
      {
        error: 'Kill switch failed after multiple attempts',
        details: lastError
      },
      { status: 500 }
    )

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
