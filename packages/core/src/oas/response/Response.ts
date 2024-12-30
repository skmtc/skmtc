import type { OasHeader } from '../header/Header.js'
import type { OasMediaType } from '../mediaType/MediaType.js'
import type { OasRef } from '../ref/Ref.js'
import type { OasSchema } from '../schema/Schema.js'

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

  toSchema(
    mediaType: string = 'application/json'
  ): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }
}
