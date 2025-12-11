export const runtime = 'nodejs';  // <-- IMPORTANT LINE

// app/api/dhan/positions/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import getDhanClientFactory from '@/lib/dhanServer' // default import

export async function GET() {
  try {
    // AWAIT cookies() once and reuse the store
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any })

    // Authenticate securely
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = userData.user

    // read saved api key (maybeSingle avoids a thrown error when no row)
    const { data: cfgData, error: cfgErr } = await supabase
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', user.id)
      .maybeSingle()

    if (cfgErr) {
      console.error('Supabase read error (trading_configs):', cfgErr)
      return NextResponse.json({ error: 'Server error reading config' }, { status: 500 })
    }

    const apiKey = cfgData?.api_key
    if (!apiKey) {
      return NextResponse.json({ error: 'No trading API key configured' }, { status: 400 })
    }

    // Dhan factory usage (default import)
    const getDhanClient = getDhanClientFactory()
    const dhan = getDhanClient(apiKey)

    const positions = await dhan.getPositions()
    return NextResponse.json(positions)
  } catch (err: any) {
    console.error('GET /api/dhan/positions error:', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
