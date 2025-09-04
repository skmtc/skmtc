import { CreateServerBody } from '@/types/createServerBody.generated.ts'
import { server } from '@/types/server.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiServersArgs = {
  supabase: SupabaseClient
  body: CreateServerBody
}

export const createApiServers = async ({
  supabase,
  body,
}: CreateApiServersArgs) => {
  const { data, error } = await supabase.functions.invoke(`/servers`, {
    method: 'POST',
    body,
  })

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
