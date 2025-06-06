import { createSupabaseClient } from '../auth/supabase-client.ts'

type PatchWorkspaceByIdArgs = {
  kv: Deno.Kv
  workspaceId: string
  baseImage: Record<string, unknown>
}

export const patchWorkspaceById = async ({
  kv,
  workspaceId,
  baseImage
}: PatchWorkspaceByIdArgs) => {
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const { data, error } = await supabase.functions.invoke(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: { baseImage }
  })

  if (error) {
    console.error('Error getting deployment', error)

    return
  }

  return data
}
