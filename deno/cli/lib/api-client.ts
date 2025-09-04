import type { Manager } from './manager.ts'
import * as v from 'valibot'
import type { OpenApiSchema } from './openapi-schema.ts'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'

type GenerateArtifactsArgs = {
  workspaceId: string
}

type UploadBaseFilesArgs = {
  workspaceId: string
  baseFiles: Record<string, unknown>
}

type UploadSchemaFileArgs = {
  openApiSchema: OpenApiSchema
  schemaId: string
}

export class ApiClient {
  manager: Manager

  constructor(manager: Manager) {
    this.manager = manager
  }
  async uploadSchemaFile({ openApiSchema, schemaId }: UploadSchemaFileArgs) {
    await this.manager.auth.ensureAuth()

    const session = await this.manager.auth.toSession()

    const path = `${session?.user.id}/${schemaId}`

    const fileName = openApiSchema.path.split('/').pop()

    const cacheControl = 3600
    const upsert = false

    const serverFilePath = `${path}/${fileName}`

    const { error } = await this.manager.auth.supabase.storage
      .from('api-schemas')
      .upload(serverFilePath, openApiSchema.contents, {
        cacheControl: cacheControl.toString(),
        upsert
      })

    if (error) {
      throw new Error(`Failed to upload schema file`, { cause: error })
    }

    return serverFilePath
  }

  async uploadBaseFiles({ workspaceId, baseFiles }: UploadBaseFilesArgs) {
    await this.manager.auth.ensureAuth()

    const session = await this.manager.auth.toSession()
    const path = `${session?.user.id}/${workspaceId}.json`

    const { error } = await this.manager.auth.supabase.storage
      .from('base-files')
      .upload(path, JSON.stringify(baseFiles), {
        upsert: true
      })

    if (error) {
      throw new Error('Failed to upload base files', { cause: error })
    }
  }
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
  originalFilePath: v.string(),
  v3JsonFilePath: v.string(),
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
  originalFilePath: string
  v3JsonFilePath: string
  createdAt: string
}

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})
