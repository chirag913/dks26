// utils/api.ts

export async function safeFetch(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    // ---------- Clean broker error handling ----------
    const textStr = typeof text === "string" ? text : JSON.stringify(text);

    if (
      textStr.includes("Invalid_Authentication") ||
      textStr.includes("DH-901") ||
      textStr.includes("access token is invalid or expired")
    ) {
      const err: any = new Error(
        "Your Dhan API key is invalid or expired. Please update it in the sidebar."
      );
      err.status = 498; // custom "Invalid Token" status
      err.body = json;
      throw err;
    }

    if (!res.ok) {
      const message =
        json?.error ??
        json?.message ??
        text ??
        res.statusText ??
        "Request failed";

      const err: any = new Error(message);
      err.status = res.status;
      err.body = json ?? text;
      throw err;
    }

    return json;
  } catch (err) {
    console.error("safeFetch error:", err);
    throw err;
  }
}

// ------------ API Helpers -------------

export async function getPositions() {
  return safeFetch("/api/dhan/positions");
}

export async function getOrders() {
  return safeFetch("/api/dhan/orders");
}

export async function triggerKill(reason?: string) {
  return safeFetch("/api/kill/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

// Validate API key before saving
export async function validateApiKey(key: string) {
  try {
    const res = await safeFetch("/api/dhan/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    return res?.ok === true;
  } catch {
    return false;
  }
}
