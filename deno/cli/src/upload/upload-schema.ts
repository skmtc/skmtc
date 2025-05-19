import { createSupabaseClient } from '../auth/supabase-client.ts'
import * as v from 'valibot'

export type Plugin = {
  id: string
  src: string
  type: 'operations' | 'models'
  description?: string
}

export type CreateSchemaBody =
  | {
      type: 'url'
      sourceUrl: string
    }
  | {
      type: 'file'
      filePath: string
    }
  | {
      type: 'refs'
      openapiSchemaIds: string[]
    }

type UploadSchemaArgs = {
  body: CreateSchemaBody
}

export const uploadSchema = async ({ body }: UploadSchemaArgs) => {
  const kv = await Deno.openKv()
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const { data, error } = await supabase.functions.invoke(`schemas`, {
    method: 'POST',
    body
  })

  if (error) {
    throw await error.context.json()
  }

  return v.parse(v.array(schema), data)
}

export const openApiVersion = v.picklist(['2.0', '3.0', '3.1'])
export type OpenApiVersion = v.InferOutput<typeof openApiVersion>

export const schemaFormat = v.picklist(['json', 'yaml'])
export type SchemaFormat = v.InferOutput<typeof schemaFormat>

export const schema = v.object({
  id: v.string(),
  schemaId: v.string(),
  name: v.string(),
  slug: v.string(),
  openapiVersion: openApiVersion,
  format: schemaFormat,
  iconKey: v.optional(v.nullable(v.string())),
  sourceUrl: v.optional(v.nullable(v.string())),
  filePath: v.optional(v.nullable(v.string())),
  createdAt: v.string()
})

export type Schema = {
  id: string
  schemaId: string
  name: string
  slug: string
  iconKey?: string | null | undefined
  openapiVersion: OpenApiVersion
  format: SchemaFormat
  sourceUrl?: string | null | undefined
  filePath?: string | null | undefined
  createdAt: string
}
