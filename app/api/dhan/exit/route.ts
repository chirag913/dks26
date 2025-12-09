import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getDhanClientFactory } from '@/lib/dhanServer'


export async function POST() {
try {
const supabase = createServerComponentClient({ cookies: () => cookies() as any })
const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
if (sessionErr) return NextResponse.json({ error: 'Auth error' }, { status: 401 })
if (!sessionData.session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })


const user = sessionData.session.user


const { data: cfgData, error: cfgErr } = await supabase
.from('trading_configs')
.select('api_key')
.eq('user_id', user.id)
.maybeSingle()


if (cfgErr) return NextResponse.json({ error: 'DB error' }, { status: 500 })
const apiKey = cfgData?.api_key
if (!apiKey) return NextResponse.json({ error: 'No Dhan API key configured' }, { status: 400 })


const dhan = getDhanClientFactory()(apiKey)


const posResp: any = await dhan.getPositions()
const positions = Array.isArray(posResp) ? posResp : (posResp?.positions ?? [])


const results: Array<{ securityId?: string; ok: boolean; error?: string }> = []


await Promise.all(
positions.map(async (p: any) => {
try {
const netQty = Number(p.netQty ?? p.NetQty ?? p.net_qty ?? 0)
if (!netQty) {
results.push({ securityId: p.securityId ?? p.SecurityId ?? null, ok: true })
return
}
const transactionType = netQty > 0 ? 'SELL' : 'BUY'
const qty = Math.abs(netQty)


const orderReq = {
dhanClientId: p.dhanClientId ?? p.DhanClientId,
correlationId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
transactionType,
exchangeSegment: p.exchangeSegment ?? p.ExchangeSegment,
productType: p.productType ?? p.ProductType,
orderType: 'MARKET',
validity: 'DAY',
securityId: p.securityId ?? p.SecurityId,
quantity: qty,
afterMarketOrder: false,
price: 0,
disclosedQuantity: 0,
triggerPrice: 0
}


await dhan.placeOrder(orderReq)
results.push({ securityId: orderReq.securityId, ok: true })
} catch (err: any) {
results.push({ securityId: p.securityId ?? p.SecurityId ?? null, ok: false, error: String(err?.message ?? err) })
}
})
)


return NextResponse.json({ ok: true, results })
} catch (err: any) {
console.error('POST /api/dhan/exit error:', err)
return NextResponse.json({ error: 'Server error', details: String(err?.message ?? err) }, { status: 500 })
}
}