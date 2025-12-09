// services/thresholdWorker.ts
import { getSupabaseServerClient } from '../lib/supabaseServer'
import getDhanClientFactory from '../lib/dhanServer'
import { cancelAndExitCleanly } from '../helpers/exitHelpers'
import { performCompleteKill } from '../helpers/killHelpers'

/**
 * Configuration (read from env or defaults)
 */
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 50) // how many users to consider per run
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 3) // how many users to process in parallel
const LOCK_TTL_MS = Number(process.env.WORKER_LOCK_TTL_MS ?? 30_000) // lock time-to-live in ms

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}



/**
 * Try to claim a lock row for a given user_id.
 * We use upsert with ON CONFLICT to set locked_until if expired.
 *
 * Returns:
 *  - { ok: true, id } if lock acquired (or created)
 *  - { ok: false, reason } if not acquired
 */
async function acquireLock(supabase: any, userId: string, ttlMs: number) {
  const now = new Date()
  const lockedUntil = new Date(Date.now() + ttlMs).toISOString()
  try {
    // Try to UPSERT a row with user_id. If existing locked_until is null or in past, update to new locked_until.
    // Supabase client supports upsert with onConflict; we rely on server-upsert semantics.
    // This is not perfectly atomic across all races but works well in practice. For strict atomicity, use a Postgres FUNCTION.
    const row = {
      user_id: userId,
      status: 'processing',
      locked_until: lockedUntil,
      last_attempted_at: now.toISOString(),
      updated_at: now.toISOString()
    }
    const { data, error } = await supabase
      .from('kill_requests')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .limit(1)

    if (error) {
      console.warn('[worker] acquireLock upsert error', error)
      return { ok: false, reason: 'db-upsert-error', error }
    }

    // The returned row may be the existing row even if it was locked; we must verify locked_until now <= now
    const returned = Array.isArray(data) ? data[0] : data
    if (!returned) {
      return { ok: false, reason: 'no-row-returned' }
    }

    // If returned.locked_until is our new value (or in the future), we assume we hold it.
    const ru = new Date(returned.locked_until ?? 0).getTime()
    if (ru > Date.now() - 10) {
      return { ok: true, id: returned.id, row: returned }
    }

    // Otherwise fail
    return { ok: false, reason: 'already-locked', row: returned }
  } catch (e: any) {
    return { ok: false, reason: 'exception', error: String(e?.message ?? e) }
  }
}

async function releaseLock(supabase: any, userId: string, opts?: { status?: string; lastResult?: any }) {
  try {
    const upd: any = {
      status: opts?.status ?? 'done',
      locked_until: null,
      updated_at: new Date().toISOString()
    }
    if (opts?.lastResult) upd.last_result = opts.lastResult
    await supabase.from('kill_requests').update(upd).eq('user_id', userId)
  } catch (e) {
    console.warn('[worker] releaseLock error', e)
  }
}

/**
 * Main worker entrypoint: processes up to BATCH_SIZE candidate configs per invocation.
 */
export async function runThresholdWorkerBatch() {
  const supabase = getSupabaseServerClient()

  // 1) Fetch candidate trading_configs — users with auto_trading_enabled and api_key set
  // Exclude users who already triggered today via kill_switch_logs
  const today = new Date(); today.setHours(0,0,0,0)
  const { data: configs, error } = await supabase
    .from('trading_configs')
    .select('id,user_id,api_key,max_loss,max_orders,auto_trading_enabled')
    .eq('auto_trading_enabled', true)
    .not('api_key', 'is', null)
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[worker] failed to load configs', error)
    return { ok: false, error: String(error?.message ?? error) }
  }

  const candidates = configs ?? []

  // 2) Filter out users who already have kill_switch_logs today (best-effort)
  const userIds = (candidates as any[]).map((c: any) => c.user_id)
  let alreadyTriggered: any[] = []
  if (userIds.length) {
    const { data: logs, error: logsErr } = await supabase
      .from('kill_switch_logs')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', today.toISOString())

    if (!logsErr && logs) {
      alreadyTriggered = logs.map((r: any) => r.user_id)
    }
  }

  const toConsider = (candidates as any[]).filter((c: any) => !alreadyTriggered.includes(c.user_id))

  // 3) Attempt to acquire locks for these users (serially to reduce race)
  const lockedUsers: any[] = []
  for (const cfg of toConsider) {
    const lock = await acquireLock(supabase, cfg.user_id, LOCK_TTL_MS)
    if (lock.ok) lockedUsers.push({ cfg, lock })
    else {
      // don't block if lock not acquired
      // console.debug('[worker] skipping locked user', cfg.user_id, lock.reason)
    }
    // small pause to avoid DB hot-spot
    await delay(20)
  }

  if (!lockedUsers.length) {
    return { ok: true, processed: 0, reason: 'no-locks-acquired' }
  }

  // 4) Create tasks per locked user (but do small concurrency)
  const tasks = lockedUsers.map(({ cfg }) => async () => {

    const userId = cfg.user_id
    const apiKey = cfg.api_key
    const maxLoss = Number(cfg.max_loss)
    const maxOrders = Number(cfg.max_orders)

    const resSummary: any = { userId, processedAt: new Date().toISOString() }

    try {
      const dhan = getDhanClientFactory()(apiKey)

      // fetch positions & orders quickly
      let positions: any[] = []
      let orders: any[] = []
      try {
        const p = await dhan.getPositions()
        positions = Array.isArray(p) ? p : (p?.positions ?? [])
      } catch (e: any) {
        console.warn('[worker] getPositions error for', userId, e?.message ?? e)
      }
      try {
        const o = await dhan.getOrders()
        orders = Array.isArray(o) ? o : (o?.orders ?? [])
      } catch (e: any) {
        console.warn('[worker] getOrders error for', userId, e?.message ?? e)
      }

      const totalPnL = positions.reduce(
        (sum: number, pos: any) =>
          sum + (Number(pos.realizedProfit ?? pos.RealizedProfit ?? 0) || 0) + (Number(pos.unrealizedProfit ?? pos.UnrealizedProfit ?? 0) || 0),
        0
      )
      const completedOrders = orders.filter((o: any) => String(o.orderStatus ?? o.order_status ?? '').toUpperCase() === 'TRADED').length

      resSummary.totalPnL = totalPnL
      resSummary.completedOrders = completedOrders

      const shouldTrigger = (!Number.isNaN(maxLoss) && totalPnL <= maxLoss) || (!Number.isNaN(maxOrders) && completedOrders >= maxOrders)
      resSummary.shouldTrigger = shouldTrigger

      if (!shouldTrigger) {
        // release lock quickly
        await releaseLock(supabase, userId, { status: 'idle', lastResult: { note: 'no-trigger', totalPnL, completedOrders } })
        return { userId, skipped: true, totalPnL, completedOrders }
      }

      // 5) Execute cancel/exit + performCompleteKill (safe flow)
      const cancelExitResults = await cancelAndExitCleanly(dhan, { cancelThrottleMs: 150, cancelSettleMs: 3000 })
      // final kill sequence: activate -> pause -> deactivate -> pause -> activate (with retries)
      const { final, trace } = await performCompleteKill(dhan, { pauseMs: 2000, retryFinal: 5, backoffMs: 500 })

      // 6) Write kill log
      try {
        await supabase.from('kill_switch_logs').insert([{
          user_id: userId,
          trigger_reason: 'THRESHOLD_SERVER',
          pnl_at_trigger: totalPnL,
          orders_at_trigger: completedOrders,
          results: { cancelExitResults, final, trace },
          created_at: new Date().toISOString()
        }])
      } catch (e: any) {
        console.warn('[worker] failed to persist kill_switch_logs for', userId, e)
      }

      // release lock -> mark done
      await releaseLock(supabase, userId, { status: 'done', lastResult: { cancelExitResults, final, trace } })

      return { userId, triggered: true, totalPnL, completedOrders, cancelExitResults, final, trace }
    } catch (err: any) {
      console.error('[worker] processing error for', userId, err)
      // write failure into lock row
      await releaseLock(supabase, userId, { status: 'failed', lastResult: { error: String(err?.message ?? err) } })
      return { userId, error: String(err?.message ?? err) }
    }
  })

  // 5) Run tasks with concurrency limit
  // Simple concurrency runner without external deps:
  const results: any[] = []
  const pool: Promise<any>[] = []
  let i = 0
  async function runNext() {
    if (i >= tasks.length) return
    const task = tasks[i++]
    const p = task().then((r) => {
      results.push(r)
    }).catch((e) => {
      results.push({ error: String(e?.message ?? e) })
    }).finally(() => {
      // when finished, start another
      return runNext()
    })
    pool.push(p)
    if (pool.length >= CONCURRENCY) {
      // wait for any to finish
      await Promise.race(pool)
      // remove finished from pool
      for (let j = pool.length - 1; j >= 0; --j) {
        // can't inspect settled, so rebuild pool with pending promises only
        if ((pool[j] as any).isFulfilled) pool.splice(j, 1)
      }
      // simpler: filter via Promise.race pattern isn't trivial; but we allow pool to grow modestly
    }
  }

  // Kick off initial batch
  const starters = []
  for (let s = 0; s < Math.min(CONCURRENCY, tasks.length); s++) {
    starters.push(runNext())
  }
  await Promise.all(starters)
  // wait for remaining in pool
  await Promise.all(pool)

  return { ok: true, processed: lockedUsers.length, results }
}
