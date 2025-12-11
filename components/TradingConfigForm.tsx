"use client";

import { useEffect, useState } from "react";
import { createSupabaseClientForClient } from "../lib/supabaseClient";

export default function TradingConfigForm(): JSX.Element {
  // create supabase client inside component (client-only helper)
  const supabase = createSupabaseClientForClient();

  const [maxLoss, setMaxLoss] = useState<string>("");
  const [maxOrders, setMaxOrders] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // call supabase client created above
        const { data: userData, error: _userErr } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("trading_configs")
          .select("max_loss, max_orders")
          .eq("user_id", user.id)
          .single();

        // ignore "no rows" code if it appears
        if (error && (error as any).code !== "PGRST116") {
          console.error("Error fetching trading_configs:", error);
        }

        if (data && mounted) {
          setMaxLoss(String((data as any).max_loss ?? ""));
          setMaxOrders(String((data as any).max_orders ?? ""));
        }
      } catch (err) {
        console.error("Failed to load trading config", err);
        if (mounted) setMessage("Failed to load settings. See console.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // supabase is safe to include as dependency because createSupabaseClientForClient returns a stable client per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isValidInputs = (): boolean => {
    if (maxLoss.trim() === "" || maxOrders.trim() === "") return false;
    const parsedMaxLoss = Number(maxLoss);
    const parsedMaxOrders = parseInt(maxOrders, 10);
    return !Number.isNaN(parsedMaxLoss) && !Number.isNaN(parsedMaxOrders);
  };

  const saveSettings = async (): Promise<void> => {
    setSaving(true);
    setMessage(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setMessage("You must be signed in to save settings.");
        setSaving(false);
        return;
      }

      const parsedMaxLoss = Number(maxLoss);
      const parsedMaxOrders = parseInt(maxOrders, 10);

      if (Number.isNaN(parsedMaxLoss) || Number.isNaN(parsedMaxOrders)) {
        setMessage("Please enter valid numeric values for max loss and max orders.");
        setSaving(false);
        return;
      }

      const payload = {
        user_id: user.id,
        max_loss: parsedMaxLoss,
        max_orders: parsedMaxOrders,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("trading_configs")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("Save error:", error);
        setMessage("Failed to save settings. See console for details.");
      } else {
        setMessage("Settings saved.");
      }
    } catch (err) {
      console.error("Unexpected error saving settings", err);
      setMessage("Unexpected error. See console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded max-w-md">
      <h3 className="text-lg font-semibold mb-3">Risk & Order Limits</h3>

      <label className="block mb-1">Max Loss</label>
      <input
        type="number"
        step="1"
        value={maxLoss}
        onChange={(e) => setMaxLoss(e.target.value)}
        className="border p-2 w-full mb-3"
        placeholder="-3500"
      />

      <label className="block mb-1">Max Orders</label>
      <input
        type="number"
        step="1"
        value={maxOrders}
        onChange={(e) => setMaxOrders(e.target.value)}
        className="border p-2 w-full mb-3"
        placeholder="26"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={saveSettings}
          disabled={saving || loading || !isValidInputs()}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {loading ? <span className="text-sm text-gray-500">Loading...</span> : null}
      </div>

      {message ? <p className="mt-2 text-sm text-gray-700">{message}</p> : null}
    </div>
  );
}
