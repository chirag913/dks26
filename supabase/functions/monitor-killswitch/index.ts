import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Supabase admin client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// Market hours: 9:15 AM – 3:30 PM IST (Mon–Fri)
function isMarketOpenIST() {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )

  const day = ist.getDay()
  if (day === 0 || day === 6) return false // Sunday / Saturday

  const minutes = ist.getHours() * 60 + ist.getMinutes()
  return minutes >= 555 && minutes <= 930
}

serve(async () => {
  const now = new Date()
  console.log("monitor-killswitch tick", now.toISOString())

  // Skip outside market hours
  if (!isMarketOpenIST()) {
    console.log("market closed")
    return new Response("closed")
  }

  console.log("market open")

  const today = now.toISOString().slice(0, 10)
  const startOfDayIST = `${today}T00:00:00+05:30`

  // Fetch ALL trading configs (do NOT filter by daily_lock_date)
  const { data: users, error: userErr } = await supabase
    .from("trading_configs")
    .select("*")

  if (userErr) {
    console.error("failed to fetch trading configs", userErr)
    return new Response("error", { status: 500 })
  }

  console.log("users fetched", users?.length ?? 0)

  for (const u of users || []) {
    try {
      console.log("checking user", u.user_id)

      // Check if already killed today
      const { data: killedToday } = await supabase
        .from("kill_switch_logs")
        .select("id")
        .eq("user_id", u.user_id)
        .gte("created_at", startOfDayIST)
        .limit(1)

      if (killedToday?.length) {
        console.log("already killed today", u.user_id)
        continue
      }

      // Fetch live PnL + order count from broker API
      const res = await fetch(
        `${Deno.env.get("SITE_URL")}/api/dhan/summary`,
        {
          headers: { "x-user-id": u.user_id }
        }
      )

      if (!res.ok) {
        console.error("summary api failed", u.user_id)
        continue
      }

      const { pnl, orders } = await res.json()

      const lossHit =
        typeof u.max_loss === "number" &&
        u.max_loss < 0 &&
        pnl <= u.max_loss

      const orderHit =
        typeof u.max_orders === "number" &&
        u.max_orders > 0 &&
        orders >= u.max_orders

      if (!lossHit && !orderHit) {
        continue
      }

      console.log("KILL TRIGGERED", {
        user_id: u.user_id,
        pnl,
        orders,
        reason: lossHit ? "MAX_LOSS" : "MAX_ORDERS"
      })

      // Trigger broker / system kill
      await fetch(`${Deno.env.get("SITE_URL")}/api/kill/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: u.user_id,
          pnl,
          orders
        })
      })

      // Insert enforcement log (SOURCE OF TRUTH)
      await supabase.from("kill_switch_logs").insert({
        user_id: u.user_id,
        pnl,
        orders,
        reason: lossHit ? "MAX_LOSS" : "MAX_ORDERS"
      })

      // Optional UI lock (NOT enforcement)
      await supabase
        .from("trading_configs")
        .update({ daily_lock_date: today })
        .eq("id", u.id)

    } catch (e) {
      console.error("user processing error", u.user_id, e)
    }
  }

  console.log("monitor-killswitch run complete")
  return new Response("ok")
})
