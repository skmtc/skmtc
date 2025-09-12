import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type GetApiServersServerNameHasWriteAccessArgs = {
  serverName: string
  supabase: SupabaseClient
}

export const getApiServersServerNameHasWriteAccessResponse = z.object({
  hasWriteAccess: z.boolean(),
})

export const getApiServersServerNameHasWriteAccess = async ({
  serverName,
  supabase,
}: GetApiServersServerNameHasWriteAccessArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/servers/${serverName}/hasWriteAccess`,
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

  return getApiServersServerNameHasWriteAccessResponse.parse(data)
}
