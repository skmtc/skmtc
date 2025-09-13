import { appLogsResponseEntry } from '@/types/appLogsResponseEntry.generated.ts'
import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export const getApiDeploymentsDeploymentIdRuntimeLogsResponse = z.array(appLogsResponseEntry)

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
  supabase
}: GetApiDeploymentsDeploymentIdRuntimeLogsArgs) => {
  const queryParams = Object.entries({ q, since, until })
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => [key, value])

  const query = new URLSearchParams(Object.fromEntries(queryParams))

  const { data, error } = await supabase.functions.invoke(
    `/deployments/${deploymentId}/runtime-logs?${query}`,
    {
      method: 'GET'
    }
  )

  console.log('DATA', data)
  console.log('ERROR', error)

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
