import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id")

  // 🔐 Internal cron authentication
  const internalSecret = req.headers.get("x-internal-cron")
  const isInternalCall =
    internalSecret === process.env.INTERNAL_CRON_SECRET

  // ❌ Block public calls without user_id
  if (!userId) {
    return NextResponse.json(
      { error: "user_id missing" },
      { status: 401 }
    )
  }

  // Fetch broker API key
  const { data: cfg, error } = await supabase
    .from("trading_configs")
    .select("api_key")
    .eq("user_id", userId)
    .single()

  // ❌ For NON-cron calls → enforce strict auth
  if (!isInternalCall) {
    if (error || !cfg?.api_key) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 401 }
      )
    }
  }

  // If cron call but no API key → treat as zero activity
  if (!cfg?.api_key) {
    return NextResponse.json({ pnl: 0, orders: 0 })
  }

  const token = cfg.api_key

 // -------- Fetch positions --------
const posRes = await fetch("https://api.dhan.co/v2/positions", {
  headers: {
    "access-token": token
  }
})

if (!posRes.ok) {
  if (!isInternalCall) {
    return NextResponse.json(
      { error: "Dhan auth failed" },
      { status: 401 }
    )
  }
  return NextResponse.json({ pnl: 0, orders: 0 })
}

const pos = await posRes.json()

// -------- Fetch orders --------
const ordRes = await fetch("https://api.dhan.co/v2/orders", {
  headers: {
    "access-token": token
  }
})

const ord = ordRes.ok ? await ordRes.json() : []


  // -------- Calculate PnL --------
  const pnl = Array.isArray(pos)
    ? pos.reduce(
        (sum: number, p: any) =>
          sum +
          Number(p.realizedProfit ?? 0) +
          Number(p.unrealizedProfit ?? 0),
        0
      )
    : 0

  // -------- Count FILLED / TRADED orders --------
  const orders = Array.isArray(ord)
    ? ord.filter((o: any) => o.orderStatus === "TRADED").length
    : 0

  return NextResponse.json({ pnl, orders })
}
