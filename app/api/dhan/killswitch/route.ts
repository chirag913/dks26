// app/api/dhan/killswitch/route.ts
export const runtime = 'nodejs';  // <-- IMPORTANT LINE

import { NextResponse } from 'next/server';

const DHAN_BASE = process.env.DHAN_BASE_URL ?? 'https://api.dhan.co/v2';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const killStatus = url.searchParams.get('killSwitchStatus') ?? 'ACTIVATE'; // or DEACTIVATE
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 });

    const resp = await fetch(`${DHAN_BASE}/killswitch?killSwitchStatus=${encodeURIComponent(killStatus)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'access-token': apiKey
      }
    });

    const text = await resp.text();
    const body = text ? JSON.parse(text) : null;
    return new NextResponse(JSON.stringify(body), { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    console.error('Server proxy killswitch error:', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
