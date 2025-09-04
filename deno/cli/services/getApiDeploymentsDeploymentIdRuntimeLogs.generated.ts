import { appLogsResponseEntry } from '@/types/appLogsResponseEntry.generated.ts'
import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export const getApiDeploymentsDeploymentIdRuntimeLogsResponse =
  z.array(appLogsResponseEntry)

export type GetApiDeploymentsDeploymentIdRuntimeLogsArgs = {
  deploymentId: string
  q?: (string | null) | undefined
  since?: (string | null) | undefined
  until?: (string | null) | undefined
  limit?: (number | null) | undefined
  supabase: SupabaseClient
}

export const getApiDeploymentsDeploymentIdRuntimeLogs = async ({
  deploymentId,
  q,
  since,
  until,
  limit,
  supabase,
}: GetApiDeploymentsDeploymentIdRuntimeLogsArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/deployments/${deploymentId}/runtime-logs`,
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

  return getApiDeploymentsDeploymentIdRuntimeLogsResponse.parse(data)
}
