// lib/supabaseServer.ts
// Server-side Supabase helper that uses the SERVICE ROLE KEY.
// Use only in server code. NEVER expose the service role key to the client.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-api-client': 'killswitch-server' } }
  })

  return cachedClient
}
