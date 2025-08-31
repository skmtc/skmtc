import { createClient } from '@supabase/supabase-js'
import { toAuthStore } from './store.ts'

export const createSupabaseClient = () => {
  const authStore = toAuthStore()
  // Create a single supabase client for interacting with your database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? 'https://api.skm.tc',
    Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_9_SstJccHh_uQqDqDt13LA_ZCbJ00y3',
    {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: authStore
      }
    }
  )

  return supabase
}
