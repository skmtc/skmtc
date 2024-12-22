import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'

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

  toSchema(
    mediaType: string = 'application/json'
  ): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }
}
