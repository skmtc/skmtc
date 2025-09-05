import type { Manager } from './manager.ts'
import * as v from 'valibot'
import type { OpenApiSchema } from './openapi-schema.ts'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'

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

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})
