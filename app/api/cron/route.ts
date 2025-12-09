// app/api/cron/route.ts
// Server route intended to be called by a cron (Vercel Cron or external scheduler).
// Iterates trading_configs with api_key and enforces kill-switch logic server-side.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DhanServerAPI } from "@/lib/dhanServer";

type ConfigRow = {
  user_id: string;
  api_key: string;
  max_loss: number | null;
  max_orders: number | null;
};

export async function POST() {
  // This route is server-only. Make sure you deploy with SUPABASE_SERVICE_ROLE_KEY set.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Find all users who have an api_key set (non-empty)
    const { data: rows, error } = await supabase
      .from("trading_configs")
      .select("user_id, api_key, max_loss, max_orders")
      .neq("api_key", "");

    if (error) {
      console.error("Supabase fetch trading_configs error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const configs = (rows || []) as ConfigRow[];

    const report: any[] = [];

    for (const cfg of configs) {
      const userReport: any = { user_id: cfg.user_id, processed: false, errors: [] };
      try {
        const dhan = new DhanServerAPI(cfg.api_key);

        // 1) Get positions and orders
        const positions = (await dhan.getPositions()) || [];
        const orders = (await dhan.getOrders()) || [];

        // 2) Compute total PnL and completed orders
        const totalPnL = positions.reduce(
          (s: number, p: any) =>
            s +
            (Number(p.realizedProfit ?? 0) || 0) +
            (Number(p.unrealizedProfit ?? 0) || 0),
          0
        );

        const completedOrders = (orders || []).filter(
          (o: any) => String(o.orderStatus ?? "").toUpperCase() === "TRADED"
        ).length;

        userReport.totalPnL = totalPnL;
        userReport.completedOrders = completedOrders;

        // 3) thresholds (use DB values if present, else fallback)
        const maxLoss = typeof cfg.max_loss === "number" ? cfg.max_loss : Number(cfg.max_loss ?? NaN);
        const maxOrders = typeof cfg.max_orders === "number" ? cfg.max_orders : Number(cfg.max_orders ?? NaN);

        const lossTriggered = Number.isFinite(maxLoss) ? totalPnL <= maxLoss : false;
        const ordersTriggered = Number.isFinite(maxOrders) ? completedOrders >= maxOrders : false;

        userReport.lossTriggered = lossTriggered;
        userReport.ordersTriggered = ordersTriggered;

        if (lossTriggered || ordersTriggered) {
          userReport.action = "triggered";

          // Step A: exit all open positions
          const openPositions = positions.filter((p: any) => Number(p.netQty ?? 0) !== 0);
          for (const pos of openPositions) {
            try {
              await dhan.exitPosition(pos);
            } catch (err) {
              console.warn("exitPosition error for user", cfg.user_id, err);
              userReport.errors.push({ stage: "exitPosition", error: String(err) });
            }
          }

          // Step B: cancel pending orders
          const pending = (orders || []).filter((o: any) => String(o.orderStatus ?? "").toUpperCase() === "PENDING");
          for (const o of pending) {
            try {
              await dhan.cancelOrder(o.orderId);
            } catch (err) {
              console.warn("cancelOrder error for user", cfg.user_id, err);
              userReport.errors.push({ stage: "cancelOrder", error: String(err) });
            }
          }

          // Step C: kill-switch activation sequence
          try {
            await dhan.activateKillSwitch();
            await new Promise((r) => setTimeout(r, 2000));
            await dhan.deactivateKillSwitch();
            await new Promise((r) => setTimeout(r, 2000));
            await dhan.activateKillSwitch();
          } catch (err) {
            console.warn("kill-switch sequence error for user", cfg.user_id, err);
            userReport.errors.push({ stage: "killSwitchSequence", error: String(err) });
          }

          // Step D: log to kill_switch_logs
          try {
            await supabase.from("kill_switch_logs").insert({
              user_id: cfg.user_id,
              trigger_reason: lossTriggered ? "Max Loss Hit" : "Max Orders Hit",
              pnl: totalPnL,
              orders_count: completedOrders,
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.warn("log kill_switch_logs error", err);
            userReport.errors.push({ stage: "logKillSwitch", error: String(err) });
          }

          // Record a trading log entry
          try {
            await supabase.from("trading_logs").insert({
              user_id: cfg.user_id,
              action_type: "CRON_KILL_TRIGGER",
              action_details: { totalPnL, completedOrders, maxLoss, maxOrders },
              ip_address: "server-cron",
              pnl: totalPnL,
              orders_count: completedOrders,
              kill_switch_status: true,
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.warn("log trading_logs error", err);
            userReport.errors.push({ stage: "logTradingLogs", error: String(err) });
          }
        } else {
          userReport.action = "no-op";
        }

        userReport.processed = true;
      } catch (err) {
        console.error("Error processing user cfg:", cfg.user_id, err);
        userReport.errors.push(String(err));
      }

      report.push(userReport);
    }

    return NextResponse.json({ ok: true, processed: report.length, report });
  } catch (err) {
    console.error("cron route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
