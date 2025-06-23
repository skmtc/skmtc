import { ensureDir, exists } from '@std/fs'
import { resolve } from 'node:path'
import type { ApiClient, CreateSchemaBody } from './api-client.ts'

type OpenApiSchemaArgs = {
  path: string
  contents: string
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

  async upload(apiClient: ApiClient) {
    const serverFilePath = await apiClient.uploadSchemaFile(this)

    const body: CreateSchemaBody = {
      type: 'file',
      filePath: serverFilePath
    }

    const [schema] = await apiClient.uploadSchema({ body })

    return schema
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
