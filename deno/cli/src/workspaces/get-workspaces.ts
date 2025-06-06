import { createSupabaseClient } from '../auth/supabase-client.ts'

export const getWorkspaces = async (kv: Deno.Kv) => {
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const { data, error } = await supabase.functions.invoke(`/workspaces`, {
    method: 'GET'
  })

  if (error) {
    console.error('Error getting deployment', error)

    return
  }

  return data
}
