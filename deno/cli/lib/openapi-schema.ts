import { exists } from '@std/fs'
import type { CreateSchemaBody } from './api-client.ts'
import type { SkmtcRoot } from './skmtc-root.ts'

type OpenApiSchemaArgs = {
  path: string
  contents: string
}

type UploadArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
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

  async upload({ projectName, skmtcRoot }: UploadArgs) {
    const workspace = await skmtcRoot.apiClient.getWorkspaceByName(projectName)

    const schemaId = workspace.schemaId

    if (schemaId) {
      const serverFilePath = await skmtcRoot.apiClient.uploadSchemaFile({
        openApiSchema: this,
        schemaId
      })

      const file: CreateSchemaBody = {
        type: 'file',
        filePath: serverFilePath
      }

      const [schema] = await skmtcRoot.apiClient.updateSchema({
        body: {
          id: schemaId,
          file: file
        }
      })

      return schema
    } else {
      const serverFilePath = await skmtcRoot.apiClient.uploadSchemaFile({
        openApiSchema: this,
        schemaId: Date.now().toString()
      })

      const body: CreateSchemaBody = {
        type: 'file',
        filePath: serverFilePath
      }

      const [schema] = await skmtcRoot.apiClient.createSchema({ body })

      return schema
    }
  }

  async write() {
    await Deno.writeTextFile(this.path, this.contents)
  }

  static create({ path, contents }: OpenApiSchemaArgs) {
    return new OpenApiSchema({ path, contents })
  }
}
