// utils/api.ts
// Safe client-side helpers for calling server + Dhan proxy routes
// IMPORTANT: Never throw for broker/auth errors — return structured responses instead

type ApiErrorResult = {
  __error: true
  code: 'EXPIRED_TOKEN' | 'NETWORK_ERROR' | 'SERVER_ERROR'
  status?: number
  message: string
  body?: any
}

const DK_EXPIRED_CODES = ['Invalid_Authentication', 'DH-901']

function makeHeaders(apiKey?: string, extra?: Record<string, string>) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(extra || {})
  }
  if (apiKey) h['x-dhan-token'] = apiKey
  return h
}

export async function safeFetch(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetch(url, opts)
    const text = await res.text()

    let json: any
    try {
      json = text ? JSON.parse(text) : undefined
    } catch {
      json = undefined
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text ?? '')

    // ---- Detect expired / invalid broker token ----
    const looksLikeAuthError =
      DK_EXPIRED_CODES.some((c) => textStr.includes(c)) ||
      textStr.toLowerCase().includes('access token is invalid') ||
      textStr.toLowerCase().includes('access token is expired') ||
      res.status === 401

    if (looksLikeAuthError) {
      return {
        __error: true,
        code: 'EXPIRED_TOKEN',
        status: res.status || 498,
        message: 'Dhan API token invalid or expired',
        body: json ?? text
      } satisfies ApiErrorResult
    }

    // ---- Other server errors ----
    if (!res.ok) {
      return {
        __error: true,
        code: 'SERVER_ERROR',
        status: res.status,
        message:
          json?.error ||
          json?.message ||
          text ||
          res.statusText ||
          'Server error',
        body: json ?? text
      } satisfies ApiErrorResult
    }

    return json
  } catch (e: any) {
    // ---- Network / fetch failure ----
    if (e instanceof TypeError && String(e.message).toLowerCase().includes('failed to fetch')) {
      return {
        __error: true,
        code: 'NETWORK_ERROR',
        message: 'Network error: failed to reach server'
      } satisfies ApiErrorResult
    }

    return {
      __error: true,
      code: 'SERVER_ERROR',
      message: e?.message ?? 'Unknown error'
    } satisfies ApiErrorResult
  }
}

/* ------------ API Helpers ------------- */

export async function getPositions(apiKey?: string) {
  return safeFetch('/api/dhan/positions', {
    method: 'GET',
    headers: makeHeaders(apiKey)
  })
}

export async function getOrders(apiKey?: string) {
  return safeFetch('/api/dhan/orders', {
    method: 'GET',
    headers: makeHeaders(apiKey)
  })
}

export async function triggerKill(apiKey?: string, payload?: any) {
  return safeFetch('/api/kill/trigger', {
    method: 'POST',
    headers: makeHeaders(apiKey),
    body: JSON.stringify(payload ?? {})
  })
}

export async function validateApiKey(key: string) {
  if (!key || key.trim().length === 0) return false
  try {
    const res: any = await safeFetch('/api/dhan/validate', {
      method: 'POST',
      headers: makeHeaders(undefined),
      body: JSON.stringify({ key: key.trim() })
    })
    return Boolean(res?.ok || res?.valid || res === true)
  } catch {
    return false
  }
}

export function createDhanAPI(apiKey?: string) {
  return {
    getPositions: () => getPositions(apiKey),
    getOrders: () => getOrders(apiKey),
    triggerKill: (payload?: any) => triggerKill(apiKey, payload)
  }
}
