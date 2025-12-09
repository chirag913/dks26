import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import getDhanClientFactory from '@/lib/dhanServer' // adjust import path


export async function POST(req: Request) {
try {
const supabase = createServerComponentClient({ cookies: () => cookies() as any })
const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
if (sessionErr) return NextResponse.json({ error: 'Auth error' }, { status: 401 })
if (!sessionData.session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })


const user = sessionData.session.user
const body = await req.json().catch(() => ({}))
const orderId = body?.orderId || body?.order_id
if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })


const { data: cfgData, error: cfgErr } = await supabase
.from('trading_configs')
.select('api_key')
.eq('user_id', user.id)
.maybeSingle()


if (cfgErr) return NextResponse.json({ error: 'DB error' }, { status: 500 })
const apiKey = cfgData?.api_key
if (!apiKey) return NextResponse.json({ error: 'No Dhan API key configured' }, { status: 400 })


const dhan = getDhanClientFactory()(apiKey)
await dhan.cancelOrder(orderId)


return NextResponse.json({ ok: true, orderId })
} catch (err: any) {
console.error('POST /api/dhan/cancel error:', err)
return NextResponse.json({ error: 'Server error', details: String(err?.message ?? err) }, { status: 500 })
}
}