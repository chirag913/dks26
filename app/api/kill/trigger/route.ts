// app/api/kill/trigger/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import getDhanClientFactory from "@/lib/dhanServer";
import { performCompleteKill } from "@/helpers/killHelpers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({
      cookies: () => cookieStore as any,
    });

    const body = await req.json().catch(() => ({}));
    const headerApiKey = req.headers.get("x-dhan-token") || undefined;
    const reason = (body?.reason as string) ?? "manual-trigger";

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? (body?.userId as string | undefined);

    if (!userId && !headerApiKey) {
      return NextResponse.json(
        { error: "No user and no token provided" },
        { status: 400 }
      );
    }

    // Resolve API key
    let apiKey = headerApiKey;
    if (!apiKey) {
      const { data: cfgData, error: cfgErr } = await supabase
        .from("trading_configs")
        .select("api_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (cfgErr) {
        console.error("[kill/trigger] DB read error", cfgErr);
        return NextResponse.json({ error: "DB read error" }, { status: 500 });
      }

      apiKey = cfgData?.api_key;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key available to call broker" },
        { status: 400 }
      );
    }

    try {
      const create = getDhanClientFactory();
      const dhan = create(apiKey);

      const { final, trace } = await performCompleteKill(dhan, {
        pauseMs: 2000,
        retryFinal: 5,
        backoffMs: 500,
      });

      // Log success
      try {
        await supabase.from("trading_logs").insert([
          {
            user_id: userId ?? null,
            event: "kill_trigger",
            detail: { final, trace },
            meta: { reason, trigger_body: body },
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (logErr) {
        console.error("[kill/trigger] log write failed:", logErr);
      }

      return NextResponse.json({ ok: final, trace });
    } catch (brokerErr: any) {
      const msg = brokerErr?.message ?? "";

      // ------------- TOKEN EXPIRED CHECK -------------
      if (
        msg.includes("Invalid_Authentication") ||
        msg.includes("DH-901") ||
        msg.includes("expired")
      ) {
        console.warn("[kill/trigger] Token expired");

        await supabase.from("trading_logs").insert([
          {
            user_id: userId ?? null,
            event: "kill_trigger_fail",
            detail: { message: "TOKEN_EXPIRED" },
            meta: { reason, trigger_body: body },
            created_at: new Date().toISOString(),
          },
        ]);

        return NextResponse.json(
          { error: "TOKEN_EXPIRED" },
          { status: 498 } // custom invalid-token status
        );
      }

      // ------------- GENERAL FAILURE -------------
      console.error("[kill/trigger] broker full-sequence failed:", msg);

      try {
        await supabase.from("trading_logs").insert([
          {
            user_id: userId ?? null,
            event: "kill_trigger_fail",
            detail: { message: msg },
            meta: { reason, trigger_body: body },
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (logErr) {
        console.error("[kill/trigger] log write failed:", logErr);
      }

      return NextResponse.json(
        { error: "BROKER_CALL_FAILED", details: msg },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("[kill/trigger] top-level error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown" },
      { status: 500 }
    );
  }
}
