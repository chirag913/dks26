import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  console.log("🔄 Daily reset started")

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Reset ONLY users who use auto trading
  const { error } = await supabase
    .from("trading_configs")
    .update({
      kill_triggered: false,
      daily_lock_date: null
    })
    .eq("auto_trading_enabled", true)

  if (error) {
    console.error("Reset failed", error)
    return new Response("error")
  }

  console.log("✅ Daily reset completed")
  return new Response("ok")
})
