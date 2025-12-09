// helpers/exitHelpers.ts
// Cancel pending orders (broadly), wait for settles, re-fetch positions, place market exits for remaining exposure.
// Returns { cancelledOrders, exitPositions, confirmStatus, trace }

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function cancelAndExitCleanly(dhanClient: any, opts?: {
  cancelThrottleMs?: number
  cancelSettleMs?: number
  confirmPollMs?: number
  confirmTimeoutMs?: number
}) {
  const cancelThrottleMs = opts?.cancelThrottleMs ?? 150
  const cancelSettleMs = opts?.cancelSettleMs ?? 3000
  const confirmPollMs = opts?.confirmPollMs ?? 800
  const confirmTimeoutMs = opts?.confirmTimeoutMs ?? 10000

  const results: any = {
    cancelledOrders: [],
    exitPositions: [],
    confirmStatus: { allClosed: false, remaining: [] },
    trace: []
  }

  // 1) fetch orders
  let ordersResp: any
  try {
    ordersResp = await dhanClient.getOrders()
  } catch (e: any) {
    results.trace.push({ step: 'getOrders', ok: false, error: String(e?.message ?? e) })
    // early return with error info
    return results
  }
  const ordersArray = Array.isArray(ordersResp) ? ordersResp : (ordersResp?.orders ?? [])

  // 2) select cancellable orders (broad statuses)
  const cancellable = ordersArray.filter((o: any) => {
    const s = String(o.orderStatus ?? o.order_status ?? o.status ?? '').toUpperCase()
    return ['PENDING','NEW','OPEN','QUEUED','ACCEPTED','PLACED','TRIGGERED'].includes(s)
  })

  results.trace.push({ step: 'foundOrders', total: ordersArray.length, cancellable: cancellable.length })

  // 3) cancel serially with throttle
  for (const o of cancellable) {
    const id = o.orderId ?? o.id ?? o.order_id
    if (!id) {
      results.cancelledOrders.push({ orderId: undefined, ok: false, error: 'id missing' })
      continue
    }
    try {
      const resp = await dhanClient.cancelOrder(id)
      results.cancelledOrders.push({ orderId: id, ok: true, resp })
      results.trace.push({ step: 'cancelOrder', orderId: id, ok: true })
    } catch (e: any) {
      results.cancelledOrders.push({ orderId: id, ok: false, error: String(e?.message ?? e) })
      results.trace.push({ step: 'cancelOrder', orderId: id, ok: false, error: String(e?.message ?? e) })
    }
    await delay(cancelThrottleMs)
  }

  // 4) wait & poll for cancellations to settle (bounded)
  const settleDeadline = Date.now() + cancelSettleMs
  while (Date.now() < settleDeadline) {
    try {
      const afterOrdersResp: any = await dhanClient.getOrders()
      const afterOrders = Array.isArray(afterOrdersResp) ? afterOrdersResp : (afterOrdersResp?.orders ?? [])
      const stillPending = afterOrders.some((o: any) => {
        const s = String(o.orderStatus ?? o.order_status ?? o.status ?? '').toUpperCase()
        return ['PENDING','NEW','OPEN','QUEUED','ACCEPTED','PLACED','TRIGGERED'].includes(s)
      })
      results.trace.push({ step: 'pollCancels', stillPending })
      if (!stillPending) break
    } catch (e: any) {
      results.trace.push({ step: 'pollCancels', ok: false, error: String(e?.message ?? e) })
      // continue until deadline
    }
    await delay(500)
  }

  // 5) re-fetch positions (after cancels)
  let posResp: any
  try {
    posResp = await dhanClient.getPositions()
  } catch (e: any) {
    results.trace.push({ step: 'getPositions', ok: false, error: String(e?.message ?? e) })
    return results
  }
  const positions = Array.isArray(posResp) ? posResp : (posResp?.positions ?? [])
  results.trace.push({ step: 'positionsFetched', count: positions.length })

  // 6) place market orders to close remaining netQty (throttled)
  for (const p of positions) {
    try {
      const netQty = Number(p.netQty ?? p.NetQty ?? p.net_qty ?? 0)
      if (!netQty) {
        results.exitPositions.push({ securityId: p.securityId ?? p.SecurityId ?? null, ok: true, note: 'no exposure' })
        continue
      }
      const transactionType = netQty > 0 ? 'SELL' : 'BUY'
      const qty = Math.abs(netQty)
      const orderReq = {
        dhanClientId: p.dhanClientId ?? p.DhanClientId,
        correlationId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`,
        transactionType,
        exchangeSegment: p.exchangeSegment ?? p.ExchangeSegment,
        productType: p.productType ?? p.ProductType,
        orderType: 'MARKET',
        validity: 'DAY',
        securityId: p.securityId ?? p.SecurityId,
        quantity: qty,
        afterMarketOrder: false,
        price: 0
      }
      const resp = await dhanClient.placeOrder(orderReq)
      results.exitPositions.push({ securityId: orderReq.securityId, ok: true, resp })
      results.trace.push({ step: 'placeExit', securityId: orderReq.securityId, ok: true })
    } catch (e: any) {
      results.exitPositions.push({ securityId: p.securityId ?? p.SecurityId ?? null, ok: false, error: String(e?.message ?? e) })
      results.trace.push({ step: 'placeExit', securityId: p.securityId ?? p.SecurityId ?? null, ok: false, error: String(e?.message ?? e) })
    }
    await delay(150)
  }

  // 7) confirm positions closed (poll until confirmTimeoutMs)
  const confirmDeadline = Date.now() + confirmTimeoutMs
  while (Date.now() < confirmDeadline) {
    try {
      const afterPosResp: any = await dhanClient.getPositions()
      const afterPositions = Array.isArray(afterPosResp) ? afterPosResp : (afterPosResp?.positions ?? [])
      const remaining = afterPositions.filter((p: any) => Number(p.netQty ?? p.NetQty ?? p.net_qty ?? 0) !== 0)
      results.trace.push({ step: 'confirmPositions', remainingCount: remaining.length })
      if (remaining.length === 0) {
        results.confirmStatus.allClosed = true
        results.confirmStatus.remaining = []
        break
      } else {
        results.confirmStatus.remaining = remaining.map((r: any) => ({ securityId: r.securityId ?? r.SecurityId, netQty: Number(r.netQty ?? r.NetQty ?? r.net_qty ?? 0) }))
      }
    } catch (e: any) {
      results.trace.push({ step: 'confirmPositions', ok: false, error: String(e?.message ?? e) })
    }
    await delay(confirmPollMs)
  }

  return results
}
