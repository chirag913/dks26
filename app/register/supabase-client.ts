import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Logging to help with debugging
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Throw an error if environment variables are missing
  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL. Check your environment variables.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing Supabase Anon Key. Check your environment variables.');
  }

  return createClientComponentClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  });
}

// Export a function to create the client
export const supabase = createSupabaseClient();