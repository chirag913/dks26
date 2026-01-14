// middleware.ts

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  // ✅ CORRECT logging (NO line numbers)
  console.log('[MIDDLEWARE HIT]', req.nextUrl.pathname)

  const res = NextResponse.next()

  /* =====================================================
     AUTH / UI MIDDLEWARE
  ===================================================== */
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect unauthenticated users away from protected pages
  if (
    !session &&
    (req.nextUrl.pathname.startsWith('/dashboard') ||
      req.nextUrl.pathname.startsWith('/analytics'))
  ) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect logged-in users away from auth pages
  if (
    session &&
    (req.nextUrl.pathname.startsWith('/login') ||
      req.nextUrl.pathname.startsWith('/register'))
  ) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // Subscription check for dashboard
  if (session && req.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const now = new Date()
    const endDate = subscription ? new Date(subscription.end_date) : null
    const isActive = endDate ? now < endDate : false
    const isTrial = subscription?.is_trial || false

    // Expose subscription info to frontend
    res.headers.set(
      'x-subscription-status',
      JSON.stringify({
        isActive,
        isTrial,
        endDate: endDate?.toISOString() || null,
      })
    )
  }

  // Admin-only analytics access
  if (session && req.nextUrl.pathname.startsWith('/analytics')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  /* =====================================================
     🔥 KILL SWITCH — API ENFORCEMENT
     - BLOCKS trading / execution APIs
     - ALLOWS monitoring APIs
  ===================================================== */
  const pathname = req.nextUrl.pathname

  const isDhanApi = pathname.startsWith('/api/dhan')
  const isSummaryApi = pathname === '/api/dhan/summary'

  // Enforce kill switch ONLY on execution APIs
  if (isDhanApi && !isSummaryApi) {
    const user_id =
      req.headers.get('x-user-id') || session?.user?.id

    if (user_id) {
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data } = await adminSupabase
        .from('trading_configs')
        .select('kill_switch_active')
        .eq('user_id', user_id)
        .single()

      if (data?.kill_switch_active) {
        return new NextResponse(
          JSON.stringify({
            error: 'Kill switch active. Trading disabled.',
          }),
          { status: 403 }
        )
      }
    }
  }

  return res
}

/* =====================================================
   MATCHER
===================================================== */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
    '/analytics/:path*',
    '/api/dhan/:path*', // 🔥 required for kill switch
  ],
}
