// lib/dhanServer.ts
const API_BASE = 'https://api.dhan.co/v2'

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
    throw new Error(`Broker error: ${res.status} ${msg}`)
  }

  return json
}

export default function getDhanClientFactory() {
  return (accessToken: string | null | undefined) => {
    if (!accessToken) {
      throw new Error('Missing Dhan access token')
    }

    return {
      async getPositions() {
        return fetchBroker('/positions', accessToken, { method: 'GET' })
      },

      async getOrders() {
        return fetchBroker('/orders', accessToken, { method: 'GET' })
      },

      async cancelOrder(orderId: string) {
        return fetchBroker(`/orders/${encodeURIComponent(orderId)}`, accessToken, { method: 'DELETE' })
      },

      async placeOrder(orderBody: unknown) {
        return fetchBroker(`/orders`, accessToken, {
          method: 'POST',
          body: JSON.stringify(orderBody),
        })
      },

      async activateKillSwitch() {
        return fetchBroker(`/killswitch?killSwitchStatus=ACTIVATE`, accessToken, { method: 'POST' })
      },

      async triggerKill(body?: any) {
        return fetchBroker(`/killswitch?killSwitchStatus=ACTIVATE`, accessToken, {
          method: 'POST',
          ...(body ? { body: JSON.stringify(body) } : {})
        })
      },

      async deactivateKillSwitch() {
        return fetchBroker(`/killswitch?killSwitchStatus=DEACTIVATE`, accessToken, { method: 'POST' })
      },

      async getKillSwitchStatus() {
        // try GET /killswitch first, then /killswitch/status
        try {
          const resp = await fetchBroker(`/killswitch`, accessToken, { method: 'GET' })
          return resp
        } catch (e) {
          try {
            const resp2 = await fetchBroker(`/killswitch/status`, accessToken, { method: 'GET' })
            return resp2
          } catch (e2) {
            throw new Error(`Unable to fetch killswitch status: ${String(e2 ?? e)}`)
          }
        }
      }
    }
  }
}
