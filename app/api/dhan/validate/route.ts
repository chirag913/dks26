// app/api/dhan/validate/route.ts
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerToken =
      req.headers.get("x-dhan-token") ||
      req.headers.get("access-token") ||
      (() => {
        const a = req.headers.get("authorization");
        return a?.startsWith("Bearer ") ? a.split(" ")[1] : null;
      })();

    const token = body?.key || headerToken || process.env.DHAN_API_KEY;
    console.log("[VALIDATE] token present?", Boolean(token));

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Missing token" }), { status: 400 });
    }

    // Dhan v2 positions (validation via positions call)
    const resp = await fetch("https://api.dhan.co/v2/positions", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        // send both variants to maximize compatibility
        "Authorization": `Bearer ${token}`,
        "access-token": token
      }
    });

    const text = await resp.text().catch(() => "");
    console.log("[VALIDATE] dh an status:", resp.status, text);

    if (resp.status === 200) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // propagate broker response for debugging (401 / DH-901 etc)
    return new Response(JSON.stringify({ ok: false, status: resp.status, body: text }), { status: resp.status });
  } catch (err) {
    console.error("[VALIDATE] error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
