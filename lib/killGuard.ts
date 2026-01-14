// lib/killGuard.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function assertKillNotActive(user_id: string) {
  const { data, error } = await supabase
    .from('trading_configs')
    .select('kill_switch_active')
    .eq('user_id', user_id)
    .single()

  if (error) throw new Error('Config fetch failed')

  if (data.kill_switch_active) {
    throw new Error('KILL_SWITCH_ACTIVE')
  }
}
