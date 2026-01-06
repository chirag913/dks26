// app/api/auth-test/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // Create direct Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get auth information from different sources
    const cookieHeader = req.headers.get('cookie') || '';
    const authHeader = req.headers.get('authorization') || '';
    
    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    // Log all cookies for debugging
    const cookieKeys = Object.keys(cookies);
    
    // Extract access token from Auth header if present
    let bearerToken = '';
    if (authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7);
    }
    
    // Attempt to get session from cookies
    let userFromCookies = null;
    let cookieError = null;
    
    const accessToken = cookies['sb-access-token'];
    const refreshToken = cookies['sb-refresh-token'];
    
    if (accessToken && refreshToken) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
          cookieError = error.message;
        } else {
          userFromCookies = data.user;
        }
      } catch (e) {
        cookieError = e instanceof Error ? e.message : 'Unknown error';
      }
    }
    
    // Attempt to get session from Bearer token
    let userFromBearer = null;
    let bearerError = null;
    
    if (bearerToken) {
      try {
        // With just an access token, we can only getUser, not set a session
        const { data, error } = await supabase.auth.getUser(bearerToken);
        
        if (error) {
          bearerError = error.message;
        } else {
          userFromBearer = data.user;
        }
      } catch (e) {
        bearerError = e instanceof Error ? e.message : 'Unknown error';
      }
    }
    
    // Return all the authentication information
    return NextResponse.json({
      cookies: {
        available: cookieKeys,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        user: userFromCookies,
        error: cookieError
      },
      headers: {
        hasAuthorizationHeader: !!authHeader,
        hasBearerToken: !!bearerToken,
        user: userFromBearer,
        error: bearerError
      },
      // Safely handle ENV vars (don't expose secrets)
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
        hasRazorpayKeySecret: !!process.env.RAZORPAY_KEY_SECRET
      }
    });
  } catch (error: any) {
    console.error('Auth test error:', error);
    return NextResponse.json({ 
      error: 'Error testing auth', 
      details: error.message 
    }, { status: 500 });
  }
}