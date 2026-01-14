import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id")

  if (!userId) {
    return NextResponse.json(
      { error: "user_id missing" },
      { status: 401 }
    )
  }

  // 🔒 Fetch trading config INCLUDING kill switch
  const { data: cfg, error } = await supabase
    .from("trading_configs")
    .select("api_key, kill_switch_active")
    .eq("user_id", userId)
    .single()

  if (error || !cfg) {
    return NextResponse.json(
      { error: "Trading config not found" },
      { status: 401 }
    )
  }

  // 🛑 HARD KILL SWITCH ENFORCEMENT
  if (cfg.kill_switch_active) {
    return NextResponse.json({
      pnl: 0,
      orders: 0,
      kill_switch: true
    })
  }

  if (!cfg.api_key) {
    return NextResponse.json(
      { error: "API key not found" },
      { status: 401 }
    )
  }

  const token = cfg.api_key

  // -------- Fetch positions --------
  const posRes = await fetch("https://api.dhan.co/v2/positions", {
    headers: {
      "access-token": token
    }
  })

  if (!posRes.ok) {
    return NextResponse.json(
      { error: "Dhan auth failed" },
      { status: 401 }
    )
  }

  const positions = await posRes.json()

  // -------- Fetch orders --------
  const ordRes = await fetch("https://api.dhan.co/v2/orders", {
    headers: {
      "access-token": token
    }
  })

  const ordersRaw = ordRes.ok ? await ordRes.json() : []

  // -------- Calculate PnL --------
  const pnl = Array.isArray(positions)
    ? positions.reduce(
        (sum: number, p: any) =>
          sum +
          Number(p.realizedProfit ?? 0) +
          Number(p.unrealizedProfit ?? 0),
        0
      )
    : 0

  // -------- Count TRADED orders --------
  const orders = Array.isArray(ordersRaw)
    ? ordersRaw.filter((o: any) => o.orderStatus === "TRADED").length
    : 0

  return NextResponse.json({ pnl, orders })
}
