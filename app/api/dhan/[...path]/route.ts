// app/api/dhan/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  // Await params if necessary
  const params = await Promise.resolve(context.params);
  const apiKey = request.headers.get('access-token');
  
  console.log('GET request to:', params.path);

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 });
  }

  try {
    // Special handling for kill switch get request
    if (params.path[0] === 'killswitch') {
      // You might want to add logic to check current kill switch status
      return NextResponse.json({ status: 'Check implementation' });
    }

    const url = `https://api.dhan.co/v2/${params.path.join('/')}`;
    console.log('DHAN API request:', url);

    const response = await fetch(url, {
      headers: new Headers({
        'access-token': apiKey
      })
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    console.log('DHAN API response:', response.status, data);

    return NextResponse.json(data || {}, { status: response.status });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch from DHAN API' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  const apiKey = request.headers.get('access-token');

  console.log('POST request to:', params.path);

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 });
  }

  try {
    // Step 1: Activate the kill switch
    const activateUrl = `https://api.dhan.co/v2/killswitch?killSwitchStatus=ACTIVATE`;
    const activateOptions: RequestInit = {
      method: 'POST',
      headers: new Headers({
        'access-token': apiKey,
        'Content-Type': 'application/json'
      })
    };

    console.log('Activating kill switch:', activateUrl);
    const activateResponse = await fetch(activateUrl, activateOptions);
    const activateResult = await activateResponse.json();
    
    console.log('Activation response:', activateResponse.status, activateResult);

    // Check if activation was successful
    if (activateResponse.ok) {
      // Step 2: Deactivate the kill switch
      const deactivateUrl = `https://api.dhan.co/v2/killswitch?killSwitchStatus=DEACTIVATE`;
      console.log('Deactivating kill switch:', deactivateUrl);
      const deactivateResponse = await fetch(deactivateUrl, activateOptions);
      const deactivateResult = await deactivateResponse.json();

      console.log('Deactivation response:', deactivateResponse.status, deactivateResult);

      // Check if deactivation was successful
      if (deactivateResponse.ok) {
        // Step 3: Reactivate the kill switch
        console.log('Reactivating kill switch:', activateUrl);
        const reActivateResponse = await fetch(activateUrl, activateOptions);
        const reActivateResult = await reActivateResponse.json();

        console.log('Reactivation response:', reActivateResponse.status, reActivateResult);

        return NextResponse.json(reActivateResult || {}, { status: reActivateResponse.status });
      } else {
        return NextResponse.json(deactivateResult || {}, { status: deactivateResponse.status });
      }
    } else {
      return NextResponse.json(activateResult || {}, { status: activateResponse.status });
    }
  } catch (error) {
    console.error('Detailed Kill Switch Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to communicate with DHAN API',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}