import { CreateSchemaBody } from '@/types/createSchemaBody.generated.ts'
import { schema } from '@/types/schema.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiSchemasArgs = {
  supabase: SupabaseClient
  body: CreateSchemaBody
}

export const createApiSchemas = async ({
  supabase,
  body,
}: CreateApiSchemasArgs) => {
  const { data, error } = await supabase.functions.invoke(`/schemas`, {
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

  return schema.parse(data)
}
