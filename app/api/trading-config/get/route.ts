// app/api/trading-config/get/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }
    const token = authHeader.substring(7)

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id

    // Use service role for reliable reads if you prefer, but anon client plus RLS should be fine.
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data, error } = await admin
      .from('trading_configs')
      .select('api_key, locked_until')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error && (error as any).code !== 'PGRST116') {
      console.error('Error reading trading_configs:', error)
      return NextResponse.json({ error: 'Failed to read config' }, { status: 500 })
    }

    const apiKey = data?.api_key ?? null
    const masked = apiKey ? `${String(apiKey).slice(0, 16)}...${String(apiKey).slice(-6)}` : null

    return NextResponse.json({
      api_key_exists: Boolean(apiKey),
      masked_api_key: masked,
      locked_until: data?.locked_until ?? null
    })
  } catch (err: any) {
    console.error('GET /api/trading-config/get error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
