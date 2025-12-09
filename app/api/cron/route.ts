// app/api/cron/route.ts
export const runtime = 'nodejs' // ensure server runtime for supabase-js and node APIs

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import getDhanClientFactory from '@/lib/dhanServer'

type ConfigRow = {
  user_id: string
  api_key: string
  max_loss: number | null
  max_orders: number | null
}

export async function POST() {
  try {
    // require service role key for server cron operations
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // fetch all trading_configs with a non-empty api_key
    const { data: rows, error } = await supabase
      .from('trading_configs')
      .select('user_id, api_key, max_loss, max_orders')
      .neq('api_key', '')

    if (error) {
      console.error('Supabase fetch trading_configs error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    const configs = (rows || []) as ConfigRow[]
    const report: any[] = []
    const createDhan = getDhanClientFactory()

    for (const cfg of configs) {
      const userReport: any = { user_id: cfg.user_id, processed: false, errors: [] }
      try {
        // build dhan client from factory
        const dhan = createDhan(cfg.api_key)

        // 1) Get positions and orders
        const positions = (await dhan.getPositions()) || []
        const orders = (await dhan.getOrders()) || []

        // 2) Compute total PnL and completed orders
        const totalPnL = positions.reduce(
          (s: number, p: any) =>
            s +
            (Number(p.realizedProfit ?? p.RealizedProfit ?? 0) || 0) +
            (Number(p.unrealizedProfit ?? p.UnrealizedProfit ?? 0) || 0),
          0
        )

        const completedOrders = (orders || []).filter((o: any) =>
          String(o.orderStatus ?? o.order_status ?? '').toUpperCase() === 'TRADED'
        ).length

        userReport.totalPnL = totalPnL
        userReport.completedOrders = completedOrders

        // 3) thresholds (use DB values if present)
        const maxLoss = typeof cfg.max_loss === 'number' ? cfg.max_loss : Number(cfg.max_loss ?? NaN)
        const maxOrders = typeof cfg.max_orders === 'number' ? cfg.max_orders : Number(cfg.max_orders ?? NaN)

        const lossTriggered = Number.isFinite(maxLoss) ? totalPnL <= maxLoss : false
        const ordersTriggered = Number.isFinite(maxOrders) ? completedOrders >= maxOrders : false

        userReport.lossTriggered = lossTriggered
        userReport.ordersTriggered = ordersTriggered

        if (lossTriggered || ordersTriggered) {
          userReport.action = 'triggered'

          // Step A: exit all open positions (best-effort)
          const openPositions = positions.filter((p: any) => Number(p.netQty ?? p.net_qty ?? 0) !== 0)
          for (const pos of openPositions) {
            try {
              // if your dhan client exposes exitPosition, call it; otherwise attempt placeOrder / close
              if (typeof (dhan as any).exitPosition === 'function') {
                await (dhan as any).exitPosition(pos)
              } else if (typeof (dhan as any).placeOrder === 'function') {
                // fallback: place a market order opposite to netQty (best-effort)
                const qty = Number(pos.netQty ?? pos.net_qty ?? 0)
                const side = qty > 0 ? 'SELL' : 'BUY'
                const orderBody = {
                  // minimal example; adapt to your broker's API shape if needed
                  instrumentToken: pos.instrumentToken ?? pos.instrument_token ?? pos.symbol,
                  transactionType: side,
                  orderType: 'MARKET',
                  quantity: Math.abs(qty)
                }
                try {
                  await (dhan as any).placeOrder(orderBody)
                } catch (e) {
                  throw e
                }
              } else {
                throw new Error('No exitPosition/placeOrder method on dhan client')
              }
            } catch (err) {
              console.warn('exitPosition error for user', cfg.user_id, err)
              userReport.errors.push({ stage: 'exitPosition', error: String(err) })
            }
          }

          // Step B: cancel pending orders
          const pending = (orders || []).filter((o: any) =>
            String(o.orderStatus ?? o.order_status ?? '').toUpperCase() === 'PENDING'
          )
          for (const o of pending) {
            try {
              // try different id shapes
              const id = o.orderId ?? o.order_id ?? o.id
              if (!id) {
                throw new Error('order id missing')
              }
              await dhan.cancelOrder(id)
            } catch (err) {
              console.warn('cancelOrder error for user', cfg.user_id, err)
              userReport.errors.push({ stage: 'cancelOrder', error: String(err) })
            }
          }

          // Step C: kill-switch activation sequence (activate -> deactivate -> activate)
          try {
            if (typeof (dhan as any).activateKillSwitch === 'function' && typeof (dhan as any).deactivateKillSwitch === 'function') {
              await (dhan as any).activateKillSwitch()
              await new Promise((r) => setTimeout(r, 2000))
              await (dhan as any).deactivateKillSwitch()
              await new Promise((r) => setTimeout(r, 2000))
              await (dhan as any).activateKillSwitch()
            } else if (typeof (dhan as any).triggerKill === 'function') {
              // fallback to single trigger call if activate/deactivate not available
              await (dhan as any).triggerKill({ reason: 'CRON_KILL_SEQUENCE' })
            } else {
              throw new Error('killswitch methods not available on dhan client')
            }
          } catch (err) {
            console.warn('kill-switch sequence error for user', cfg.user_id, err)
            userReport.errors.push({ stage: 'killSwitchSequence', error: String(err) })
          }

          // Step D: log to kill_switch_logs (best-effort)
          try {
            await supabase.from('kill_switch_logs').insert({
              user_id: cfg.user_id,
              trigger_reason: lossTriggered ? 'Max Loss Hit' : 'Max Orders Hit',
              pnl: totalPnL,
              orders_count: completedOrders,
              created_at: new Date().toISOString()
            })
          } catch (err) {
            console.warn('log kill_switch_logs error', err)
            userReport.errors.push({ stage: 'logKillSwitch', error: String(err) })
          }

          // Step E: trading_logs entry
          try {
            await supabase.from('trading_logs').insert({
              user_id: cfg.user_id,
              action_type: 'CRON_KILL_TRIGGER',
              action_details: { totalPnL, completedOrders, maxLoss, maxOrders },
              ip_address: 'server-cron',
              pnl: totalPnL,
              orders_count: completedOrders,
              kill_switch_status: true,
              created_at: new Date().toISOString()
            })
          } catch (err) {
            console.warn('log trading_logs error', err)
            userReport.errors.push({ stage: 'logTradingLogs', error: String(err) })
          }
        } else {
          userReport.action = 'no-op'
        }

        userReport.processed = true
      } catch (err) {
        console.error('Error processing user cfg:', cfg.user_id, err)
        userReport.errors.push(String(err))
      }

      report.push(userReport)
    }

    return NextResponse.json({ ok: true, processed: report.length, report })
  } catch (err) {
    console.error('cron route error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
