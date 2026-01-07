import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

function isMarketOpenIST() {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )

  const day = ist.getDay()
  if (day === 0 || day === 6) return false

  const minutes = ist.getHours() * 60 + ist.getMinutes()
  return minutes >= 555 && minutes <= 930
}

serve(async () => {
  await supabase.from("killswitch_cron_heartbeat").insert({});
  console.log("monitor-killswitch tick", new Date().toISOString())

  if (!isMarketOpenIST()) {
    console.log("market closed")
    return new Response("closed")
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: users, error } = await supabase
    .from("trading_configs")
    .select("*")

  if (error) {
    console.error("failed to fetch users", error)
    return new Response("error", { status: 500 })
  }

  for (const u of users || []) {
    try {
      const res = await fetch(
        `${Deno.env.get("SITE_URL")}/api/dhan/summary`,
        {
          headers: {
            "x-user-id": u.user_id,
            "x-internal-cron": Deno.env.get("INTERNAL_CRON_SECRET")!
          }
        }
      )

      if (!res.ok) continue

      const { pnl, orders } = await res.json()

      const lossHit =
        typeof u.max_loss === "number" &&
        u.max_loss < 0 &&
        pnl <= u.max_loss

      const orderHit =
        typeof u.max_orders === "number" &&
        u.max_orders > 0 &&
        orders >= u.max_orders

      if (!lossHit && !orderHit) continue

      console.log("KILL TRIGGERED", u.user_id, pnl, orders)

      // Trigger kill
      await fetch(`${Deno.env.get("SITE_URL")}/api/kill/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: u.user_id,
          pnl,
          orders
        })
      })

      // Log kill (source of truth)
      await supabase.from("kill_switch_logs").insert({
        user_id: u.user_id,
        pnl,
        orders,
        reason: lossHit ? "MAX_LOSS" : "MAX_ORDERS"
      })

      // Optional UI lock
      await supabase
        .from("trading_configs")
        .update({ daily_lock_date: today })
        .eq("id", u.id)

    } catch (e) {
      console.error("user error", u.user_id, e)
    }
  }

  return new Response("ok")
})
