// app/api/monitor/route.ts
export const runtime = 'nodejs' // ensure full Node runtime for supabase-js

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Define types for better TypeScript support
interface UserSettings {
  id?: string;
  user_id: string;
  max_loss?: number | null;
  max_orders?: number | null;
  notification_email?: string | null;
  notification_enabled?: boolean | null;
  // Add any other settings fields you have
}

interface AlertInfo {
  type: 'max_loss' | 'max_orders' | 'other';
  message: string;
  details: Record<string, any>;
}

// Create a service role client for monitoring (server runtime required)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Record heartbeat at the start of each monitoring run
    const heartbeatTimestamp = new Date().toISOString();
    await supabase.from('monitoring_heartbeats').insert({
      timestamp: heartbeatTimestamp,
      status: 'active',
      service: 'cron-monitor'
    });

    // 1. Fetch all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    // 2. For each user, check their trading conditions
    for (const subscription of subscriptions || []) {
      if (!subscription || !('user_id' in subscription)) continue;

      // Get user's monitoring settings
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', subscription.user_id)
        .maybeSingle();

      if (settingsError) {
        // ignore not found vs real error: log and continue
        console.warn('Settings fetch error for user', subscription.user_id, settingsError);
        continue;
      }

      const userSettings = settings as UserSettings | null;
      if (!userSettings) continue; // Skip if no settings

      // Check trading conditions (implement your monitoring logic here)
      const alertTriggered = await checkTradingConditions(subscription.user_id, userSettings);

      // If alert conditions met, send notification
      if (alertTriggered) {
        await sendAlert(subscription.user_id, alertTriggered);
      }
    }

    return NextResponse.json({ success: true, message: 'Monitoring completed' });
  } catch (error) {
    console.error('Monitoring error:', error);
    return NextResponse.json(
      {
        error: 'Error running monitoring',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Implement these functions according to your existing logic
async function checkTradingConditions(userId: string, settings: UserSettings): Promise<AlertInfo | null> {
  // Placeholder implementation - replace with your actual monitoring logic
  try {
    // 1. Fetch user's trading positions
    const { data: positions, error: posError } = await supabase
      .from('trading_positions')
      .select('*')
      .eq('user_id', userId);

    if (posError) {
      console.error(`Positions fetch error for user ${userId}:`, posError);
      throw posError;
    }

    // 2. Calculate total loss/profit
    let totalLoss = 0;
    const totalOrders = positions?.length ?? 0; // <-- changed to const to fix prefer-const error

    (positions || []).forEach((position: any) => {
      // Calculate profit/loss for each position
      // This is just an example, replace with your actual calculation fields
      const current = Number(position.current_value ?? position.currentValue ?? 0);
      const entry = Number(position.entry_value ?? position.entryValue ?? 0);
      totalLoss += current - entry;
    });

    // 3. Check against thresholds
    if (typeof settings.max_loss === 'number' && Math.abs(totalLoss) > settings.max_loss) {
      return {
        type: 'max_loss',
        message: `Maximum loss threshold of ${settings.max_loss} exceeded`,
        details: {
          currentLoss: totalLoss,
          threshold: settings.max_loss
        }
      };
    }

    if (typeof settings.max_orders === 'number' && totalOrders > settings.max_orders) {
      return {
        type: 'max_orders',
        message: `Maximum number of orders (${settings.max_orders}) exceeded`,
        details: {
          currentOrders: totalOrders,
          threshold: settings.max_orders
        }
      };
    }

    // No alert conditions met
    return null;
  } catch (error) {
    console.error(`Error checking trading conditions for user ${userId}:`, error);
    return null;
  }
}

async function sendAlert(userId: string, alertInfo: AlertInfo): Promise<void> {
  try {
    // 1. Store the alert in the database
    await supabase.from('alerts').insert({
      user_id: userId,
      type: alertInfo.type,
      message: alertInfo.message,
      details: alertInfo.details,
      status: 'new',
      created_at: new Date().toISOString()
    });

    // 2. Get user's notification preferences
    const { data: userInfo, error: userError } = await supabase
      .from('user_settings')
      .select('notification_email, notification_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) {
      console.warn(`Failed to fetch user notification settings for ${userId}:`, userError);
      return;
    }

    if (!userInfo || !userInfo.notification_enabled) {
      // notifications disabled or no email configured
      return;
    }

    const email = userInfo.notification_email;
    if (!email) return;

    // 3. Send email notification (placeholder)
    console.log(`Would send email to ${email}: ${alertInfo.message}`);

    // 4. Update alert as notified (mark existing 'new' alerts for this user/type as 'notified')
    await supabase
      .from('alerts')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', alertInfo.type)
      .eq('status', 'new');
  } catch (error) {
    console.error(`Error sending alert for user ${userId}:`, error);
    // Continue execution even if sending alert fails
  }
}
