import type { OasHeader } from '../header/Header.ts'
import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type ResponseFields = {
  description?: string | undefined
  headers?: Record<string, OasHeader | OasRef<'header'>> | undefined
  content?: Record<string, OasMediaType> | undefined
  extensionFields?: Record<string, unknown>
}

export class OasResponse {
  oasType: 'response' = 'response'
  description: string | undefined
  headers: Record<string, OasHeader | OasRef<'header'>> | undefined
  content: Record<string, OasMediaType> | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ResponseFields) {
    this.description = fields.description
    this.headers = fields.headers
    this.content = fields.content
    this.extensionFields = fields.extensionFields
  }

  isRef(): this is OasRef<'response'> {
    return false
  }

  resolve(): OasResponse {
    return this
  }

  resolveOnce(): OasResponse {
    return this
  }

  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ResponseObject {
    return {
      description: this.description ?? '',
      headers: Object.fromEntries(
        Object.entries(this.headers ?? {}).map(([header, headerObject]) => [
          header,
          headerObject.toJsonSchema(options)
        ])
      ),
      content: Object.fromEntries(
        Object.entries(this.content ?? {}).map(([mediaType, mediaTypeObject]) => [
          mediaType,
          mediaTypeObject.toJsonSchema(options)
        ])
      )
    }
  }
}
