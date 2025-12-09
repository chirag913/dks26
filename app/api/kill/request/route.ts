// lib/dhanServer.ts
// Minimal Dhan API wrapper used by server routes.
// NOTE: this file runs server-side and must never expose secrets to the browser.

export class DhanServerAPI {
  private token: string;
  private base = "https://api.dhan.co/v2";
  constructor(token: string) {
    if (!token) throw new Error("Dhan API token required");
    this.token = token;
  }

  private async request(path: string, opts: RequestInit = {}) {
    const url = `${this.base}${path}`;
    const headers: any = {
      "Accept": "application/json",
      "access-token": this.token,
      ...(opts.headers || {})
    };
    const res = await fetch(url, { ...opts, headers });
    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      // non-json response
    }
    if (!res.ok) {
      const err = new Error(`Dhan API ${res.status} ${res.statusText}: ${text}`);
      // @ts-ignore
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // Returns array of positions
  async getPositions(): Promise<any[]> {
    const res = await this.request("/positions", { method: "GET" });
    // If Dhan returns object or wrapper, adapt here — we return an array
    if (Array.isArray(res)) return res;
    // common wrapper may be { data: [...] }
    if (res?.data && Array.isArray(res.data)) return res.data;
    return [];
  }

  // Returns array of orders
  async getOrders(): Promise<any[]> {
    const res = await this.request("/orders", { method: "GET" });
    if (Array.isArray(res)) return res;
    if (res?.data && Array.isArray(res.data)) return res.data;
    return [];
  }

  // Exit a single position (server-side). Accepts either a position object or minimal fields.
  async exitPosition(position: any) {
    // Build minimal payload expected by Dhan (adapt to your Dhan integration)
    const payload = {
      dhanClientId: position.dhanClientId ?? position.dhanClientID ?? undefined,
      correlationId: (Math.random().toString(36).slice(2, 12)),
      transactionType: (position.netQty && Number(position.netQty) > 0) ? "SELL" : "BUY",
      exchangeSegment: position.exchangeSegment ?? position.exchange_segment,
      productType: position.productType ?? position.product_type ?? "INTRADAY",
      orderType: "MARKET",
      validity: "DAY",
      securityId: position.securityId ?? position.security_id ?? position.tradingSymbol,
      quantity: Math.abs(Number(position.netQty ?? position.quantity ?? 0)) || Math.abs(Number(position.netQty ?? 0)),
      afterMarketOrder: false,
      price: 0,
      disclosedQuantity: 0,
      triggerPrice: 0
    };

    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
  }

  // Cancel an order by id
  async cancelOrder(orderId: string) {
    if (!orderId) throw new Error("orderId required");
    return this.request(`/orders/${orderId}`, { method: "DELETE" });
  }

  async activateKillSwitch() {
    return this.request(`/killswitch?killSwitchStatus=ACTIVATE`, { method: "POST" });
  }

  async deactivateKillSwitch() {
    return this.request(`/killswitch?killSwitchStatus=DEACTIVATE`, { method: "POST" });
  }
}
