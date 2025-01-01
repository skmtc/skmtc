import type { OasMediaType } from '../mediaType/MediaType.js'
import type { OasRef } from '../ref/Ref.js'
import type { OasSchema } from '../schema/Schema.js'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'
import type { OpenAPIV3 } from 'openapi-types'

export type RequestBodyFields = {
  description?: string | undefined
  content: Record<string, OasMediaType>
  required?: boolean | undefined
  extensionFields?: Record<string, unknown>
}

export class OasRequestBody {
  oasType: 'requestBody' = 'requestBody'
  description: string | undefined
  content: Record<string, OasMediaType>
  required: boolean | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: RequestBodyFields) {
    this.description = fields.description
    this.content = fields.content
    this.required = fields.required
    this.extensionFields = fields.extensionFields
  }

  isRef(): this is OasRef<'requestBody'> {
    return false
  }

  resolve(): OasRequestBody {
    return this
  }

  resolveOnce(): OasRequestBody {
    return this
  }

  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.RequestBodyObject {
    return {
      description: this.description,
      content: Object.fromEntries(
        Object.entries(this.content).map(([mediaType, mediaTypeObject]) => [
          mediaType,
          mediaTypeObject.toJsonSchema(options)
        ])
      ),
      required: this.required
    }
  }
}
