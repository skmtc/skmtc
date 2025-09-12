import { PatchSchemaBody } from '@/types/patchSchemaBody.generated.ts'
import { schema } from '@/types/schema.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type PatchApiSchemasSchemaIdArgs = {
  schemaId: string
  supabase: SupabaseClient
  body: PatchSchemaBody
}

export const patchApiSchemasSchemaId = async ({
  schemaId,
  supabase,
  body,
}: PatchApiSchemasSchemaIdArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `/schemas/${schemaId}`,
    {
      method: 'PATCH',
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

  return schema.parse(data)
}
