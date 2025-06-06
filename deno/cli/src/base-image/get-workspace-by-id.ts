import { createSupabaseClient } from '../auth/supabase-client.ts'

type GetWorkspaceByIdArgs = {
  kv: Deno.Kv
  workspaceId: string
}

export const getWorkspaceById = async ({ kv, workspaceId }: GetWorkspaceByIdArgs) => {
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const { data, error } = await supabase.functions.invoke(`/workspaces/find?id=${workspaceId}`, {
    method: 'GET'
  })

  if (error) {
    console.error('Error getting deployment', error)

    return
  }

  return data
}
