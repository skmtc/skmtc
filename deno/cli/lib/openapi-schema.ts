import { exists } from '@std/fs/exists'
import type { SkmtcRoot } from './skmtc-root.ts'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'
import { patchApiSchemasSchemaId } from '../services/patchApiSchemasSchemaId.generated.ts'
import { CreateSchemaBodyFile } from '../types/createSchemaBodyFile.generated.ts'
import { createApiSchemas } from '../services/createApiSchemas.generated.ts'

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
    const workspace = await getApiWorkspacesWorkspaceName({
      workspaceName: projectName,
      supabase: skmtcRoot.manager.auth.supabase
    })

    const schemaId = workspace.schema.id

    if (schemaId) {
      const serverFilePath = await skmtcRoot.apiClient.uploadSchemaFile({
        openApiSchema: this,
        schemaId
      })

      const file: CreateSchemaBodyFile = {
        type: 'file',
        fileContent: serverFilePath
      }

      const schema = await patchApiSchemasSchemaId({
        schemaId,
        supabase: skmtcRoot.manager.auth.supabase,
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

      const schema = await createApiSchemas({
        supabase: skmtcRoot.manager.auth.supabase,
        body: { type: 'file', fileContent: serverFilePath }
      })

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
