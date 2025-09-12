import { deployment } from '@/types/deployment.generated.ts'
import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export const getApiServersServerNameResponse = z.array(deployment)

export type GetApiServersServerNameArgs = {
  serverName: string
  supabase: SupabaseClient
}

export const getApiServersServerName = async ({
  serverName,
  supabase,
}: GetApiServersServerNameArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/servers/${serverName}`,
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

  return getApiServersServerNameResponse.parse(data)
}
