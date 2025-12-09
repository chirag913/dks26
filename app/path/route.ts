// app/api/dhan/[...path]/route.ts
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  const apiKey = request.headers.get('access-token')
  console.log('GET request to:', params.path)

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }

  try {
    const url = `https://api.dhan.co/v2/${params.path.join('/')}`
    console.log('DHAN API request:', url)

    const response = await fetch(url, {
      headers: new Headers({
        'access-token': apiKey,
        'Content-Type': 'application/json'
      })
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null
    console.log('DHAN API response:', response.status, data)

    return NextResponse.json(data || {}, { status: response.status })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch from DHAN API' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  const apiKey = request.headers.get('access-token')
  console.log('POST request to:', params.path)

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }

  try {
    let url = `https://api.dhan.co/v2/${params.path.join('/')}`
    if (params.path[0] === 'killswitch') {
      url = 'https://api.dhan.co/v2/killswitch?killSwitchStatus=ACTIVATE'
    }
    console.log('DHAN API request:', url)

    const response = await fetch(url, {
      method: 'POST', 
      headers: new Headers({
        'access-token': apiKey,
        'Content-Type': 'application/json'
      })
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null
    console.log('DHAN API response:', response.status, data)

    return NextResponse.json(data || {}, { status: response.status })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to communicate with DHAN API' }, { status: 500 })
  }
}