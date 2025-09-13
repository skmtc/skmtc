import { ClientSettings } from '@/types/clientSettings.generated.ts'
import { PrettierConfigType } from '@/types/prettierConfigType.generated.ts'
import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiServersAccountNameServerNameArtifactsArgs = {
  accountName: string
  serverName: string
  supabase: SupabaseClient
  body: {
    schema: string
    clientSettings?: ClientSettings | undefined
    prettier?: PrettierConfigType | undefined
  }
}

export const createApiServersAccountNameServerNameArtifacts = async ({
  accountName,
  serverName,
  supabase,
  body
}: CreateApiServersAccountNameServerNameArtifactsArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/servers/${accountName}/${serverName}/artifacts`,
    {
      method: 'POST',
      body
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

  return createArtifactsResponse.parse(data)
}
