// app/api/trading-config/save/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const auth = req.headers.get("authorization")
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jwt = auth.replace("Bearer ", "")
  const { data: { user }, error } = await supabase.auth.getUser(jwt)

  if (!user || error) {
    return NextResponse.json({ error: "Invalid user" }, { status: 401 })
  }

  const { api_key } = await req.json()
  if (!api_key) {
    return NextResponse.json({ error: "API key required" }, { status: 400 })
  }

  // update if exists, else insert
  const { data: existing } = await supabase
    .from("trading_configs")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    const { error: updErr } = await supabase
      .from("trading_configs")
      .update({
        api_key,
        daily_lock_date: null
      })
      .eq("user_id", user.id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  } else {
    const { error: insErr } = await supabase
      .from("trading_configs")
      .insert({
        user_id: user.id,
        api_key
      })

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
