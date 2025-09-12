import { workspaceDetails } from '@/types/workspaceDetails.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type GetApiWorkspacesWorkspaceNameArgs = {
  workspaceName: string
  supabase: SupabaseClient
}

export const getApiWorkspacesWorkspaceName = async ({
  workspaceName,
  supabase,
}: GetApiWorkspacesWorkspaceNameArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/workspaces/${workspaceName}`,
    {
      method: 'GET',
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

  return workspaceDetails.parse(data)
}
