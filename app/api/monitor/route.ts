// app/api/monitor/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface UserSettings {
  id: string
  user_id: string
  max_loss?: number
  max_orders?: number
  notification_email?: string
  notification_enabled?: boolean
}

interface AlertInfo {
  type: 'max_loss' | 'max_orders' | 'other'
  message: string
  details: Record<string, any>
}

/**
 * Create supabase client lazily using dynamic import to avoid require() warnings.
 * Returns null if required env vars are missing (we don't throw at module load time).
 */
async function createSupabaseClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  // dynamic import (ES module) — eslint-friendly
  // note: import() returns module namespace; we destructure createClient
  const supabaseModule = await import('@supabase/supabase-js')
  const createClient = supabaseModule.createClient as typeof supabaseModule.createClient

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(_: NextRequest) {
  const supabase = await createSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  try {
    const heartbeatTimestamp = new Date().toISOString()
    // safe insert (ignore insertion failure but log)
    try {
      await supabase.from('monitoring_heartbeats').insert({
        timestamp: heartbeatTimestamp,
        status: 'active',
        service: 'cron-monitor',
      })
    } catch (hbErr) {
      // non-fatal — we continue monitoring even if heartbeat insert fails
      // eslint-disable-next-line no-console
      console.error('Heartbeat insert failed', hbErr)
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active')

    if (subError) {
      throw subError
    }

    for (const subscription of subscriptions || []) {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', subscription.user_id)
        .single()

      // PGRST116 is PostgREST "no rows" code — skip when no settings
      if (settingsError && (settingsError?.code !== 'PGRST116' || !settings)) {
        // eslint-disable-next-line no-console
        console.error('Error fetching settings', subscription.user_id, settingsError)
        continue
      }
      if (!settings) continue

      const alert = await checkTradingConditions(subscription.user_id, settings as UserSettings, supabase)
      if (alert) {
        await sendAlert(subscription.user_id, alert, supabase)
      }
    }

    return NextResponse.json({ success: true, message: 'Monitoring completed' })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Monitoring error:', error)
    return NextResponse.json(
      { error: 'Error running monitoring', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

async function checkTradingConditions(
  userId: string,
  settings: UserSettings,
  supabaseClient: any
): Promise<AlertInfo | null> {
  try {
    const { data: positions, error: posError } = await supabaseClient
      .from('trading_positions')
      .select('*')
      .eq('user_id', userId)

    if (posError) throw posError

    let totalLoss = 0
    const totalOrders = positions?.length || 0

    positions?.forEach((position: any) => {
      const entry = Number(position.entry_value ?? 0)
      const current = Number(position.current_value ?? 0)
      totalLoss += current - entry
    })

    if (settings.max_loss && Math.abs(totalLoss) > settings.max_loss) {
      return {
        type: 'max_loss',
        message: `Maximum loss threshold of ${settings.max_loss} exceeded`,
        details: { currentLoss: totalLoss, threshold: settings.max_loss },
      }
    }

    if (settings.max_orders && totalOrders > settings.max_orders) {
      return {
        type: 'max_orders',
        message: `Maximum number of orders (${settings.max_orders}) exceeded`,
        details: { currentOrders: totalOrders, threshold: settings.max_orders },
      }
    }

    return null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error checking trading conditions for user ${userId}:`, err)
    return null
  }
}

async function sendAlert(userId: string, alertInfo: AlertInfo, supabaseClient: any): Promise<void> {
  try {
    await supabaseClient.from('alerts').insert({
      user_id: userId,
      type: alertInfo.type,
      message: alertInfo.message,
      details: alertInfo.details,
      status: 'new',
    })

    const { data: userInfo, error: userError } = await supabaseClient
      .from('user_settings')
      .select('notification_email, notification_enabled')
      .eq('user_id', userId)
      .single()

    if (userError || !userInfo || !userInfo.notification_enabled) {
      return
    }

    // eslint-disable-next-line no-console
    console.log(`Would send email to ${userInfo.notification_email}: ${alertInfo.message}`)

    await supabaseClient
      .from('alerts')
      .update({ status: 'notified' })
      .eq('user_id', userId)
      .eq('type', alertInfo.type)
      .eq('status', 'new')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error sending alert for user ${userId}:`, err)
  }
}
