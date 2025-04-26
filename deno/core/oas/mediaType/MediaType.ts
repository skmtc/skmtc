import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasExample } from '../example/Example.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type MediaTypeFields = {
  mediaType: string
  schema?: OasSchema | OasRef<'schema'> | undefined
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  extensionFields?: Record<string, unknown>
  encoding?: Record<string, unknown> | undefined
}

export class OasMediaType {
  oasType: 'mediaType' = 'mediaType'
  mediaType: string
  schema: OasSchema | OasRef<'schema'> | undefined
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  extensionFields: Record<string, unknown> | undefined
  encoding?: Record<string, unknown> | undefined
  constructor(fields: MediaTypeFields) {
    this.mediaType = fields.mediaType
    this.schema = fields.schema
    this.examples = fields.examples
    this.encoding = fields.encoding
    this.extensionFields = fields.extensionFields
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.MediaTypeObject {
    return {
      schema: this.schema?.toJsonSchema(options),
      examples: this.examples
    }
  }
}
