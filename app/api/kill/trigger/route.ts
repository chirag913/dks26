// app/api/kill/trigger/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import getDhanClientFactory from '@/lib/dhanServer'
import { performCompleteKill } from '@/helpers/killHelpers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()

    const supabase = createServerComponentClient({
      cookies: () => cookieStore
    })

    const body = await req.json().catch(() => ({}))
    const reason = body?.reason ?? 'ui-trigger'

    // 🔐 AUTHENTICATED USER (SOURCE OF TRUTH)
    const { data: userData, error: authErr } =
      await supabase.auth.getUser()

    if (authErr || !userData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = userData.user.id

    // 🔑 Fetch API key for THIS user only
    const { data: cfg, error } = await supabase
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', userId)
      .single()

    if (error || !cfg?.api_key) {
      return NextResponse.json(
        { error: 'API key not found for user' },
        { status: 400 }
      )
    }

    const create = getDhanClientFactory()
    const dhan = create(cfg.api_key)

    // 🔥 EXECUTE REAL KILL
    const { final, trace } = await performCompleteKill(dhan, {
      pauseMs: 2000,
      retryFinal: 5,
      backoffMs: 500
    })

    // 🧾 LOG ENFORCEMENT
    await supabase.from('kill_switch_logs').insert({
      user_id: userId,
      reason,
      detail: { final, trace },
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      enforced: final
    })
  } catch (err: any) {
    console.error('[kill/trigger]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 }
    )
  }
}
