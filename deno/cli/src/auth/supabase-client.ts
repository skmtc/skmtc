import { createClient } from '@supabase/supabase-js'

type CreateSupabaseClientArgs = {
  kv: Deno.Kv
}

export const createSupabaseClient = ({ kv }: CreateSupabaseClientArgs) => {
  // Create a single supabase client for interacting with your database
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
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
  })

  return supabase
}
