import type { Manager } from './manager.ts'
import { ApiClient, type CreateSchemaBody } from './api-client.ts'
import type { OpenApiSchema } from './openapi-schema.ts'

export class SchemaUpload {
  apiClient: ApiClient

  constructor(manager: Manager) {
    this.apiClient = new ApiClient(manager)
  }

  async upload(openApiSchema: OpenApiSchema) {
    const serverFilePath = await this.apiClient.uploadSchemaFile(openApiSchema)

    const body: CreateSchemaBody = {
      type: 'file',
      filePath: serverFilePath
    }

    const [schema] = await this.apiClient.uploadSchema({ body })

    return schema
  }
}
