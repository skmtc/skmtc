import { ensureDir, exists } from '@std/fs'
import { resolve } from 'node:path'
import type { ApiClient, CreateSchemaBody } from './api-client.ts'
import type { KvState } from './kv-state.ts'

type OpenApiSchemaArgs = {
  path: string
  contents: string
}

type UploadArgs = {
  kvState: KvState
  apiClient: ApiClient
}

type UnlinkArgs = {
  kvState: KvState
}

type InfoArgs = {
  kvState: KvState
}

export class OpenApiSchema {
  path: string
  contents: string

  private constructor({ path, contents }: OpenApiSchemaArgs) {
    this.path = path
    this.contents = contents
  }

  static async exists(path: string): Promise<boolean> {
    return await exists(path, { isFile: true })
  }

  static async open(path: string): Promise<OpenApiSchema> {
    const hasOpenApiSchema = await OpenApiSchema.exists(path)

    if (!hasOpenApiSchema) {
      throw new Error('OpenAPI schema not found')
    }

    const contents = await Deno.readTextFile(path)

    return new OpenApiSchema({ path, contents })
  }

  async upload({ kvState, apiClient }: UploadArgs) {
    const schemaId = await kvState.getSchemaId({ path: this.path })

    if (schemaId) {
      const serverFilePath = await apiClient.uploadSchemaFile({
        openApiSchema: this,
        schemaId
      })

      const file: CreateSchemaBody = {
        type: 'file',
        filePath: serverFilePath
      }

      const [schema] = await apiClient.updateSchema({
        body: {
          id: schemaId,
          file: file
        }
      })

      return schema
    } else {
      const serverFilePath = await apiClient.uploadSchemaFile({
        openApiSchema: this,
        schemaId: Date.now().toString()
      })

      const body: CreateSchemaBody = {
        type: 'file',
        filePath: serverFilePath
      }

      const [schema] = await apiClient.createSchema({ body })

      kvState.setSchemaId({ path: this.path, schemaId: schema.id })

      return schema
    }
  }

  async unlink({ kvState }: UnlinkArgs) {
    await kvState.clearSchemaId({ path: this.path })
  }

  async info({ kvState }: InfoArgs) {
    const info = await kvState.getSchemaId({ path: this.path })

    return info
  }

  async write() {
    const schemaPath = resolve(Deno.cwd(), this.path)

    await ensureDir(schemaPath)

    await Deno.writeTextFile(schemaPath, this.contents)
  }

  static create({ path, contents }: OpenApiSchemaArgs) {
    return new OpenApiSchema({ path, contents })
  }
}
