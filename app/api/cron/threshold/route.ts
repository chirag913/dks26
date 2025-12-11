// app/api/cron/threshold/route.ts
import { NextResponse } from 'next/server'
import { runThresholdWorkerBatch } from '../../../../services/thresholdWorker' // <-- correct export name

export async function POST(req: Request) {
  try {
    // Accept either header OR query param (Vercel cron cannot set custom headers)
    const headerToken = req.headers.get('x-cron-token') || ''
    // parse url for query param `secret`
    const url = new URL(req.url)
    const querySecret = url.searchParams.get('secret') || ''

    const secret = process.env.CRON_SECRET || ''

    if (!secret) {
      console.error('[cron/threshold] missing CRON_SECRET env var')
      return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 })
    }

    if (!headerToken && !querySecret) {
      console.warn('[cron/threshold] missing cron secret (no header and no query)')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    if ((headerToken && headerToken !== secret) || (querySecret && querySecret !== secret)) {
      console.warn('[cron/threshold] unauthorized cron call (secret mismatch)')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const start = Date.now()
    const res = await runThresholdWorkerBatch()
    const tookMs = Date.now() - start

    console.log(`[cron/threshold] finished in ${tookMs}ms`, res?.results ? { processed: (res as any).results.length } : null)
    return NextResponse.json({ ok: true, tookMs, result: res })
  } catch (err: any) {
    console.error('[cron/threshold] error', err)
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
