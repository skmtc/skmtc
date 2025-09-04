import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type GetApiServersStackNameHasWriteAccessArgs = {
  stackName: string
  supabase: SupabaseClient
}

export const getApiServersStackNameHasWriteAccessResponse = z.object({
  hasWriteAccess: z.boolean(),
})

export const getApiServersStackNameHasWriteAccess = async ({
  stackName,
  supabase,
}: GetApiServersStackNameHasWriteAccessArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/servers/${stackName}/hasWriteAccess`,
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

  return getApiServersStackNameHasWriteAccessResponse.parse(data)
}
