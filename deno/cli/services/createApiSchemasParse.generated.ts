import { ParseSchemaBody } from '@/types/parseSchemaBody.generated.ts'
import { z } from 'zod'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiSchemasParseArgs = {
  supabase: SupabaseClient
  body: ParseSchemaBody
}

export const createApiSchemasParseResponse = z.record(z.string(), z.unknown())

export const createApiSchemasParse = async ({
  supabase,
  body,
}: CreateApiSchemasParseArgs) => {
  const { data, error } = await supabase.functions.invoke(`/schemas/parse`, {
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

  return createApiSchemasParseResponse.parse(data)
}
