export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    const { data: cfg, error } = await supabase
      .from('trading_configs')
      .select('api_key, kill_switch_active')
      .eq('user_id', user_id)
      .single()

    if (error || !cfg?.api_key) {
      return NextResponse.json(
        { error: 'Invalid trading config' },
        { status: 500 }
      )
    }

    if (cfg.kill_switch_active) {
      return NextResponse.json({ ok: true, alreadyActive: true })
    }

    const headers = { 'access-token': cfg.api_key }

    const ACTIVATE =
      'https://api.dhan.co/v2/killswitch?killSwitchStatus=ACTIVATE'
    const DEACTIVATE =
      'https://api.dhan.co/v2/killswitch?killSwitchStatus=DEACTIVATE'

    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        let res = await fetch(ACTIVATE, {
          method: 'POST',
          headers,
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(await res.text())

        await sleep(STEP_DELAY_MS)

        res = await fetch(DEACTIVATE, {
          method: 'POST',
          headers,
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(await res.text())

        await sleep(STEP_DELAY_MS)

        res = await fetch(ACTIVATE, {
          method: 'POST',
          headers,
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(await res.text())

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
          message: 'Kill switch activated'
        })

      } catch (err: any) {
        lastError = err.message
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    return NextResponse.json(
      { error: 'Kill switch failed', details: lastError },
      { status: 500 }
    )

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
