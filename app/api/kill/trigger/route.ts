// app/api/kill/trigger/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id")

    if (!userId) {
      return NextResponse.json(
        { error: "user_id missing" },
        { status: 401 }
      )
    }

    // 🔐 Fetch user's broker API key
    const { data: cfg, error } = await supabase
      .from("trading_configs")
      .select("api_key")
      .eq("user_id", userId)
      .single()

    if (error || !cfg?.api_key) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 401 }
      )
    }

    const token = cfg.api_key

    // 🛑 Call broker kill switch
    const res = await fetch("https://api.dhan.co/v2/killswitch", {
      method: "POST",
      headers: {
        "access-token": token
      }
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Broker kill switch failed" },
        { status: 500 }
      )
    }

    // 🧾 Persist kill trigger for the day
    await supabase
      .from("trading_configs")
      .update({
        daily_lock_date: new Date().toISOString()
      })
      .eq("user_id", userId)

    return NextResponse.json({
      success: true,
      message: "Kill switch activated"
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}
