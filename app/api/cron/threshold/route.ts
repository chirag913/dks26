// app/api/cron/threshold/route.ts
// Protected cron endpoint that triggers the server threshold worker.
// Vercel (or any external scheduler) should POST to this route with header `x-cron-token: <CRON_SECRET>`.

import { NextResponse } from 'next/server'
import { runThresholdWorkerBatch } from '../../../../services/thresholdWorker' // <-- correct export name

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-cron-token') || ''
    const secret = process.env.CRON_SECRET || ''

    if (!secret) {
      console.error('[cron/threshold] missing CRON_SECRET env var')
      return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 })
    }

    if (!token || token !== secret) {
      console.warn('[cron/threshold] unauthorized cron call')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const start = Date.now()
    const res = await runThresholdWorkerBatch() // call the actual worker entrypoint
    const tookMs = Date.now() - start

    console.log(`[cron/threshold] finished in ${tookMs}ms`, res?.results ? { processed: (res as any).results.length } : null)
    return NextResponse.json({ ok: true, tookMs, result: res })
  } catch (err: any) {
    console.error('[cron/threshold] error', err)
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
