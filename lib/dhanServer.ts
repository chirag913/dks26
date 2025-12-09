// lib/dhanServer.ts
// Backwards-compatible Dhan client factory.
// - Exports named `getDhanClientFactory` and default export.
// - Adds light-weight exitPosition helper (best-effort market exit).
// - Keeps existing methods: getPositions, getOrders, cancelOrder, placeOrder, activateKillSwitch, deactivateKillSwitch, triggerKill, getKillSwitchStatus

const API_BASE = 'https://api.dhan.co/v2'

type AnyObj = Record<string, any>

async function fetchBroker(path: string, token: string, opts: RequestInit = {}) {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'access-token': token
  }

  const finalOpts: RequestInit = {
    ...opts,
    headers: {
      ...headers,
      ...(opts.headers || {})
    },
  }

  const res = await fetch(url, finalOpts)
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch (e) {
    json = { raw: text }
  }

  if (!res.ok) {
    const msg = json?.message ?? JSON.stringify(json)
    const err: any = new Error(`Broker error: ${res.status} ${msg}`)
    err.status = res.status
    err.body = json
    throw err
  }

  return json
}

function buildDhanClient(accessToken: string | null | undefined) {
  if (!accessToken) {
    throw new Error('Missing Dhan access token')
  }
  const token = accessToken!

  return {
    async getPositions(): Promise<any> {
      return fetchBroker('/positions', token, { method: 'GET' })
    },

    async getOrders(): Promise<any> {
      return fetchBroker('/orders', token, { method: 'GET' })
    },

    async cancelOrder(orderId: string): Promise<any> {
      return fetchBroker(`/orders/${encodeURIComponent(orderId)}`, token, { method: 'DELETE' })
    },

    async placeOrder(orderBody: AnyObj): Promise<any> {
      return fetchBroker(`/orders`, token, {
        method: 'POST',
        body: JSON.stringify(orderBody),
      })
    },

    async activateKillSwitch(): Promise<any> {
      return fetchBroker(`/killswitch?killSwitchStatus=ACTIVATE`, token, { method: 'POST' })
    },

    async triggerKill(body?: any): Promise<any> {
      return fetchBroker(`/killswitch?killSwitchStatus=ACTIVATE`, token, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    },

    async deactivateKillSwitch(): Promise<any> {
      return fetchBroker(`/killswitch?killSwitchStatus=DEACTIVATE`, token, { method: 'POST' })
    },

    async getKillSwitchStatus(): Promise<any> {
      try {
        const resp = await fetchBroker(`/killswitch`, token, { method: 'GET' })
        return resp
      } catch (e) {
        // fallback path
        const resp2 = await fetchBroker(`/killswitch/status`, token, { method: 'GET' })
        return resp2
      }
    },

    /**
     * Best-effort exitPosition helper:
     * - Attempts to derive symbol, quantity and side from the position object
     * - Places a MARKET order on the opposite side to close the position
     *
     * NOTE: Broker payloads vary. Edit the built order shape to match your broker's expected fields
     * (e.g. instrument_token vs tradingSymbol, product, order_type, exchange, etc.)
     */
    async exitPosition(pos: AnyObj): Promise<any> {
      try {
        // derive quantity (try a few common field names)
        const qty =
          Math.abs(Number(pos.netQty ?? pos.net_qty ?? pos.quantity ?? pos.qty ?? pos.volume ?? 0)) || 0
        if (!qty || qty <= 0) {
          throw new Error('Cannot determine position quantity for exit')
        }

        // derive symbol/trading token
        const symbol =
          pos.tradingSymbol ?? pos.symbol ?? pos.instrument ?? pos.instrumentToken ?? pos.instrument_token ?? null
        if (!symbol) {
          throw new Error('Cannot determine instrument/symbol for exit')
        }

        // determine side: if netQty positive -> SELL to exit; if negative -> BUY to exit
        const net = Number(pos.netQty ?? pos.net_qty ?? pos.quantity ?? pos.qty ?? 0) || 0
        const side = net > 0 ? 'SELL' : 'BUY'

        // build a conservative market order body. Adapt to your broker if necessary.
        const orderBody: AnyObj = {
          tradingSymbol: symbol,
          quantity: qty,
          orderType: 'MARKET',
          product: pos.product ?? 'MIS', // keep MIS as default; change if you need CNC or NRML
          side, // SELL or BUY
          // you may need to add exchange/variety/validity depending on Dhan API
        }

        // Call placeOrder — if your broker expects different field names, change orderBody above.
        return await this.placeOrder(orderBody)
      } catch (e) {
        // rethrow so callers can record failure
        throw e
      }
    }
  }
}

/**
 * Named factory for compatibility with many server files:
 *   const getDhanClient = getDhanClientFactory(); const dhan = getDhanClient(apiKey)
 */
export function getDhanClientFactory() {
  return (accessToken: string | null | undefined) => buildDhanClient(accessToken)
}

/** Compatibility aliases (some files import these names) */
export const createDhanClientFactory = getDhanClientFactory
export const createDhanAPI = getDhanClientFactory
export const DhanServerAPI = getDhanClientFactory

/** default export for `import getDhanClientFactory from '@/lib/dhanServer'` style */
export default getDhanClientFactory
