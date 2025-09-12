import { DenoDeploymentAssets } from '@/types/denoDeploymentAssets.generated.ts'
import { server } from '@/types/server.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiServersAccountNameServerNameArgs = {
  accountName: string
  serverName: string
  supabase: SupabaseClient
  body: DenoDeploymentAssets
}

export const createApiServersAccountNameServerName = async ({
  accountName,
  serverName,
  supabase,
  body,
}: CreateApiServersAccountNameServerNameArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/servers/${accountName}/${serverName}`,
    {
      method: 'POST',
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

  return server.parse(data)
}
