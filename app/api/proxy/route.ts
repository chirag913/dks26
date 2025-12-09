// app/api/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { path, method = 'GET', body: reqBody = null } = body
    const apiKey = req.headers.get('x-user-api-key') || process.env.BROKER_SERVICE_KEY
    const base = process.env.NEXT_PUBLIC_BROKER_BASE || process.env.BROKER_BASE

    if (!base) {
      return NextResponse.json({ error: 'BROKER_BASE not configured' }, { status: 500 })
    }
    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const url = `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`

    const forwardResp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
      },
      // don't forward browser cookies by default; change if required
      body: reqBody ? JSON.stringify(reqBody) : undefined,
    })

    const text = await forwardResp.text()
    // preserve content-type header if present
    const contentType = forwardResp.headers.get('content-type') || 'application/json'
    return new NextResponse(text, {
      status: forwardResp.status,
      headers: {
        'content-type': contentType
      }
    })
  } catch (err: any) {
    console.error('Proxy error', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
