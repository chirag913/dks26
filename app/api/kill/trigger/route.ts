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
    const userId = body?.user_id;

    if (!userId) {
      return NextResponse.json(
        { error: "user_id required" },
        { status: 400 }
      );
    }

    const { data: cfg } = await supabase
      .from("trading_configs")
      .select("api_key")
      .eq("user_id", userId)
      .single();

    if (!cfg?.api_key) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 400 }
      );
    }

    const dhan = getDhanClientFactory()(cfg.api_key);

    const { final, trace } = await performCompleteKill(dhan);

    await supabase.from("kill_switch_logs").insert({
      user_id: userId,
      trigger_reason: body.reason ?? "ui",
      trigger_source: "ui",
      detail: { final, trace },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, enforced: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
