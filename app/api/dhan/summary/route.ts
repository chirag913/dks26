import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json({ error: "user_id missing" }, { status: 401 })
  }

  const { data: cfg, error } = await supabase
    .from("trading_configs")
    .select("api_key")
    .eq("user_id", userId)
    .single()

  if (error || !cfg?.api_key) {
    return NextResponse.json({ error: "API key not found" }, { status: 401 })
  }

  const token = cfg.api_key

  const posRes = await fetch("https://api.dhan.co/v2/positions", {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!posRes.ok) {
    return NextResponse.json({ error: "Dhan auth failed" }, { status: 401 })
  }

  const pos = await posRes.json()

  const ordRes = await fetch("https://api.dhan.co/v2/orders", {
    headers: { Authorization: `Bearer ${token}` }
  })

  const ord = ordRes.ok ? await ordRes.json() : []

  const pnl = Array.isArray(pos)
    ? pos.reduce(
        (s: number, p: any) =>
          s + Number(p.realizedProfit ?? 0) + Number(p.unrealizedProfit ?? 0),
        0
      )
    : 0

  const orders = Array.isArray(ord)
    ? ord.filter((o: any) => o.orderStatus === "TRADED").length
    : 0

  return NextResponse.json({ pnl, orders })
}
