import type { OasRef } from '../ref/Ref.js'
import type { OasSchema } from '../schema/Schema.js'
import type { OasExample } from '../example/Example.js'

export type MediaTypeFields = {
  mediaType: string
  schema?: OasSchema | OasRef<'schema'> | undefined
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  extensionFields?: Record<string, unknown>
}

export class OasMediaType {
  oasType: 'mediaType' = 'mediaType'
  mediaType: string
  schema: OasSchema | OasRef<'schema'> | undefined
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  extensionFields: Record<string, unknown> | undefined

  constructor(fields: MediaTypeFields) {
    this.mediaType = fields.mediaType
    this.schema = fields.schema
    this.examples = fields.examples
    this.extensionFields = fields.extensionFields
  }
}
