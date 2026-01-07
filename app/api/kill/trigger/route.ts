// app/api/kill/trigger/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import getDhanClientFactory from "@/lib/dhanServer";
import { performCompleteKill } from "@/helpers/killHelpers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body?.user_id as string | undefined;
    const reason = body?.reason ?? "cron";

    if (!userId) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // 🔒 Fetch API key STRICTLY by user_id
    const { data: cfg, error } = await supabase
      .from("trading_configs")
      .select("api_key, max_orders, max_loss")
      .eq("user_id", userId)
      .single();

    if (error || !cfg?.api_key) {
      return NextResponse.json(
        { error: "API key not found for user" },
        { status: 400 }
      );
    }

    const apiKey = cfg.api_key;

    // 🔑 Create correct Dhan client
    const create = getDhanClientFactory();
    const dhan = create(apiKey);

    // 🔥 Always attempt kill
    const { final, trace } = await performCompleteKill(dhan, {
      pauseMs: 2000,
      retryFinal: 5,
      backoffMs: 500,
    });

    // ✅ ALWAYS LOG (even if already active)
    await supabase.from("kill_switch_logs").insert({
      user_id: userId,
      trigger_reason: reason,
      trigger_source: "cron",
      detail: { final, trace },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      enforced: true,
      broker_final: final,
      note: "Kill enforced or already active",
    });

  } catch (err: any) {
    console.error("[kill/trigger] fatal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
