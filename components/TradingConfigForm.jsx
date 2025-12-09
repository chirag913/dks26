"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TradingConfigForm() {
  const [maxLoss, setMaxLoss] = useState("");
  const [maxOrders, setMaxOrders] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Get current user
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          // Not signed in
          if (mounted) setLoading(false);
          return;
        }

        // Query trading_configs for this user
        const { data, error } = await supabase
          .from("trading_configs")
          .select("max_loss, max_orders")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "No rows found" sometimes; ignore that case
          console.error("Error fetching trading_configs:", error);
        }

        if (data) {
          if (mounted) {
            setMaxLoss(String(data.max_loss ?? ""));
            setMaxOrders(String(data.max_orders ?? ""));
          }
        }
      } catch (err) {
        console.error("Failed to load trading config", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Save / upsert
  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        alert("You must be signed in to save settings.");
        setSaving(false);
        return;
      }

      // Basic validation & normalization
      const parsedMaxLoss = Number(maxLoss);
      const parsedMaxOrders = parseInt(maxOrders, 10);

      if (Number.isNaN(parsedMaxLoss) || Number.isNaN(parsedMaxOrders)) {
        alert("Please enter valid numeric values for max loss and max orders.");
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
        alert("Failed to save settings: " + error.message);
      } else {
        alert("Settings saved.");
      }
    } catch (err) {
      console.error("Unexpected error saving settings", err);
      alert("Unexpected error. Check console.");
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

      <button
        onClick={saveSettings}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {loading ? <p className="mt-2 text-sm text-gray-500">Loading...</p> : null}
    </div>
  );
}