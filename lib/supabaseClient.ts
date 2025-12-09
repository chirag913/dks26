// lib/supabaseClient.ts
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

/**
 * Returns a Supabase client configured for client components.
 * Call inside client components (not at module top-level server code).
 */
export function createSupabaseClientForClient() {
  return createClientComponentClient()
}