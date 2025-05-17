import { createClient } from '@supabase/supabase-js'

type CreateSupabaseClientArgs = {
  kv: Deno.Kv
}

export const createSupabaseClient = ({ kv }: CreateSupabaseClientArgs) => {
  // Create a single supabase client for interacting with your database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? 'https://api.codesquared.com',
    Deno.env.get('SUPABASE_ANON_KEY') ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaW1wdmhzaGphZHd2Y3BicGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDI0MDczNzAsImV4cCI6MjAxNzk4MzM3MH0.y6ao2vy1-DU6rRoQng3JVZQjb__xaoeBsPR2WxrP5vI',
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
