import { deploymentInfo } from '@/types/deploymentInfo.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type GetApiDeploymentsDeploymentIdArgs = {
  deploymentId: string
  supabase: SupabaseClient
}

export const getApiDeploymentsDeploymentId = async ({
  deploymentId,
  supabase,
}: GetApiDeploymentsDeploymentIdArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/deployments/${deploymentId}`,
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

  return deploymentInfo.parse(data)
}
