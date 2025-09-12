import { PatchWorkspaceBody } from '@/types/patchWorkspaceBody.generated.ts'
import { workspace } from '@/types/workspace.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type PatchApiWorkspacesWorkspaceIdArgs = {
  workspaceId: string
  supabase: SupabaseClient
  body: PatchWorkspaceBody
}

export const patchApiWorkspacesWorkspaceId = async ({
  workspaceId,
  supabase,
  body,
}: PatchApiWorkspacesWorkspaceIdArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/workspaces/${workspaceId}`,
    {
      method: 'PATCH',
      body,
    },
  )

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const errorMessage = await error.context.json()
      Object.entries(errorMessage?.validationErrors).forEach(([key, value]) => {
        console.error(`${key}: ${value}`)
      })
    }

    throw new Error(`Failed to deploy stack`)
  }

  return workspace.parse(data)
}
