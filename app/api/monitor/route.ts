// app/api/monitor/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Define types for better TypeScript support
interface UserSettings {
  id: string;
  user_id: string;
  max_loss: number;
  max_orders: number;
  notification_email: string;
  notification_enabled: boolean;
  // Add any other settings fields you have
}

interface AlertInfo {
  type: 'max_loss' | 'max_orders' | 'other';
  message: string;
  details: Record<string, any>;
}

// Create a service role client for monitoring
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
      // Record heartbeat at the start of each monitoring run
      const heartbeatTimestamp = new Date().toISOString();
      await supabase
        .from('monitoring_heartbeats')
        .insert({
          timestamp: heartbeatTimestamp,
          status: 'active',
          service: 'cron-monitor'
        });
        
    // 1. Fetch all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active');
    
    if (subError) throw subError;
    
    // 2. For each user, check their trading conditions
    for (const subscription of subscriptions || []) {
      // Get user's monitoring settings
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', subscription.user_id)
        .single();
      
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (!settings) continue; // Skip if no settings
      
      // Check trading conditions (implement your monitoring logic here)
      const alertTriggered = await checkTradingConditions(
        subscription.user_id, 
        settings as UserSettings
      );
      
      // If alert conditions met, send notification
      if (alertTriggered) {
        await sendAlert(subscription.user_id, alertTriggered);
      }
    }
    
    return NextResponse.json({ success: true, message: 'Monitoring completed' });
  } catch (error) {
    console.error('Monitoring error:', error);
    return NextResponse.json(
      { error: 'Error running monitoring', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Implement these functions according to your existing logic
async function checkTradingConditions(
  userId: string, 
  settings: UserSettings
): Promise<AlertInfo | null> {
  // Placeholder implementation - replace with your actual monitoring logic
  try {
    // 1. Fetch user's trading positions
    const { data: positions, error: posError } = await supabase
      .from('trading_positions')
      .select('*')
      .eq('user_id', userId);
      
    if (posError) throw posError;
    
    // 2. Calculate total loss/profit
    let totalLoss = 0;
    let totalOrders = positions?.length || 0;
    
    positions?.forEach(position => {
      // Calculate profit/loss for each position
      // This is just an example, replace with your actual calculation
      totalLoss += position.current_value - position.entry_value;
    });
    
    // 3. Check against thresholds
    if (settings.max_loss && Math.abs(totalLoss) > settings.max_loss) {
      return {
        type: 'max_loss',
        message: `Maximum loss threshold of ${settings.max_loss} exceeded`,
        details: {
          currentLoss: totalLoss,
          threshold: settings.max_loss
        }
      };
    }
    
    if (settings.max_orders && totalOrders > settings.max_orders) {
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
      status: 'new'
    });
    
    // 2. Get user's notification preferences
    const { data: userInfo, error: userError } = await supabase
      .from('user_settings')
      .select('notification_email, notification_enabled')
      .eq('user_id', userId)
      .single();
      
    if (userError || !userInfo || !userInfo.notification_enabled) {
      return; // Skip if notifications disabled or error
    }
    
    // 3. Send email notification (example, implement with your preferred email service)
    // This is a placeholder - you'll need to implement actual email sending
    console.log(`Would send email to ${userInfo.notification_email}: ${alertInfo.message}`);
    
    // To implement actual email sending, you could use a service like SendGrid:
    // Example with SendGrid (you would need to install @sendgrid/mail)
    /*
    import sgMail from '@sendgrid/mail';
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    
    await sgMail.send({
      to: userInfo.notification_email,
      from: 'alerts@killswitchpro.com',
      subject: `KillSwitch Alert: ${alertInfo.type}`,
      text: alertInfo.message,
      html: `<strong>${alertInfo.message}</strong><p>Details: ${JSON.stringify(alertInfo.details)}</p>`
    });
    */
    
    // 4. Update alert as notified
    await supabase
      .from('alerts')
      .update({ status: 'notified' })
      .eq('user_id', userId)
      .eq('type', alertInfo.type)
      .eq('status', 'new');
      
  } catch (error) {
    console.error(`Error sending alert for user ${userId}:`, error);
    // Continue execution even if sending alert fails
  }
}