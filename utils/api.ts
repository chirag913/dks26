// utils/api.ts
// Lightweight client-side API helpers for calling your server and Dhan proxy routes.
// - safeFetch wraps fetch and creates friendly, structured errors for auth/network issues.
// - getPositions/getOrders/triggerKill accept an optional apiKey which is sent as x-dhan-token.

type FetchError = Error & {
  status?: number
  body?: any
  code?: string
}

const DK_EXPIRED_CODES = ['Invalid_Authentication', 'DH-901']

function makeHeaders(apiKey?: string, extra?: Record<string, string>) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(extra || {})
  }
  if (apiKey) {
    h['x-dhan-token'] = apiKey
  }
  return h
}

export async function safeFetch(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetch(url, opts)
    const text = await res.text()

    let json: any = undefined
    try {
      json = text ? JSON.parse(text) : undefined
    } catch {
      json = undefined
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text ?? '')

    // Detect broker-side expired/invalid token messages and normalize them
    const looksLikeAuthError =
      DK_EXPIRED_CODES.some((c) => textStr.includes(c)) ||
      textStr.toLowerCase().includes('access token is invalid') ||
      textStr.toLowerCase().includes('access token is expired') ||
      (res.status === 401 && textStr.length > 0)

    if (looksLikeAuthError) {
      const err: FetchError = new Error('Dhan API token invalid or expired')
      err.status = 498 // custom client-side status for expired token
      err.body = json ?? text
      err.code = 'EXPIRED_TOKEN'
      throw err
    }

    if (!res.ok) {
      const message =
        json?.error ||
        json?.message ||
        text ||
        res.statusText ||
        'Server returned an error'

      const err: FetchError = new Error(String(message))
      err.status = res.status
      err.body = json ?? text
      throw err
    }

    return json
  } catch (e: any) {
    // Network-level failure (e.g., offline, CORS, DNS)
    if (e instanceof TypeError && String(e.message).toLowerCase().includes('failed to fetch')) {
      const err: FetchError = new Error('Network error: failed to reach server')
      err.code = 'NETWORK_ERROR'
      throw err
    }
    // If we already created a structured FetchError above, rethrow it
    throw e
  }
}

/* ------------ API Helpers ------------- */

/**
 * Fetch positions via server proxy. Pass optional apiKey to forward as header.
 */
export async function getPositions(apiKey?: string) {
  return safeFetch('/api/dhan/positions', {
    method: 'GET',
    headers: makeHeaders(apiKey)
  })
}

/**
 * Fetch orders via server proxy. Pass optional apiKey to forward.
 */
export async function getOrders(apiKey?: string) {
  return safeFetch('/api/dhan/orders', {
    method: 'GET',
    headers: makeHeaders(apiKey)
  })
}

/**
 * Trigger kill sequence on the server (/api/kill/trigger).
 * If apiKey is provided it will be forwarded in x-dhan-token header (useful for client-side trigger).
 * `payload` will be JSON-encoded.
 */
export async function triggerKill(apiKey?: string, payload?: any) {
  return safeFetch('/api/kill/trigger', {
    method: 'POST',
    headers: makeHeaders(apiKey),
    body: JSON.stringify(payload ?? {})
  })
}

/**
 * Validate an API key server-side (calls /api/dhan/validate).
 * Returns true when API returns ok, false otherwise.
 */
export async function validateApiKey(key: string) {
  if (!key || key.trim().length === 0) return false
  try {
    const res = await safeFetch('/api/dhan/validate', {
      method: 'POST',
      headers: makeHeaders(undefined), // don't send x-dhan-token here; key in body
      body: JSON.stringify({ key: key.trim() })
    })
    // Many validate endpoints return { ok: true } or similar; be permissive
    return Boolean(res?.ok || res?.valid || res === true)
  } catch {
    return false
  }
}

/**
 * Backwards-compatible factory: createDhanAPI(apiKey?)
 * Returns an object with the same methods you used previously in UI code.
 */
export function createDhanAPI(apiKey?: string) {
  return {
    getPositions: () => getPositions(apiKey),
    getOrders: () => getOrders(apiKey),
    triggerKill: (payload?: any) => triggerKill(apiKey, payload)
  }
}
