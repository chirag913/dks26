import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id")

  if (!userId) {
    return NextResponse.json({ error: "user_id missing" }, { status: 401 })
  }

  // ✅ Create Supabase client INSIDE handler (prevents Railway crash loop)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 🔒 Load config
  const { data: cfg, error } = await supabase
    .from("trading_configs")
    .select("api_key, kill_switch_active")
    .eq("user_id", userId)
    .single()

  if (error || !cfg?.api_key) {
    return NextResponse.json(
      { error: "Trading config / API key missing" },
      { status: 401 }
    )
  }

  const token = cfg.api_key

  // 🔄 Fetch positions (always allowed)
  const posRes = await fetch("https://api.dhan.co/v2/positions", {
    headers: { "access-token": token },
    cache: "no-store"
  })

  if (!posRes.ok) {
    return NextResponse.json(
      { error: "Dhan auth failed" },
      { status: 401 }
    )
  }

  const positions = await posRes.json()

  // 🔄 Fetch orders (safe parse)
  let ordersRaw: any[] = []

  try {
    const ordRes = await fetch("https://api.dhan.co/v2/orders", {
      headers: { "access-token": token },
      cache: "no-store"
    })

    if (ordRes.ok) {
      ordersRaw = await ordRes.json()
    }
  } catch {
    ordersRaw = []
  }

  // 📊 Calculate PnL
  const pnl = Array.isArray(positions)
    ? positions.reduce(
        (sum: number, p: any) =>
          sum +
          Number(p.realizedProfit ?? 0) +
          Number(p.unrealizedProfit ?? 0),
        0
      )
    : 0

  // 📦 Count traded orders
  const orders = Array.isArray(ordersRaw)
    ? ordersRaw.filter((o: any) => o.orderStatus === "TRADED").length
    : 0

  // ✅ ALWAYS return summary (even after 3:30 & kill switch)
  return NextResponse.json(
    {
      pnl,
      orders,
      kill_switch: Boolean(cfg.kill_switch_active)
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  )
}
