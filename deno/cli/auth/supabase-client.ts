import { createClient } from '@supabase/supabase-js'

type CreateSupabaseClientArgs = {
  kv: Deno.Kv
}

export const createSupabaseClient = ({ kv }: CreateSupabaseClientArgs) => {
  // Create a single supabase client for interacting with your database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? 'https://api.skm.tc',
    Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_9_SstJccHh_uQqDqDt13LA_ZCbJ00y3',
    {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: {
          getItem: async key => {
            try {
              const { value } = await kv.get(['auth', key])

              return value as string | null
            } catch (_error) {
              return null
            }
          },
          setItem: async (key, value) => {
            await kv.set(['auth', key], value)
          },
          removeItem: async key => {
            try {
              await kv.delete(['auth', key])
            } catch (_error) {
              // ignore
            }
          }
        }
      }
    }
  )

  return supabase
}
