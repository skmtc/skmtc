import type { OpenAPIV3 } from 'openapi-types'
import type { OasRef } from '../ref/Ref.js'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'

export type UnknownFields = {
  title?: string
  description?: string
  extensionFields?: Record<string, unknown>
  example?: unknown
}

/**
 * Object representing an unknown type in the OpenAPI Specification.
 *
 * JSON schema treats a definition without any type information as 'any'.
 * Since this is not useful in an API context, we use OasUnknown to
 * represent types that are not specified.
 */
export class OasUnknown {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'unknown' useful for type narrowing and tagged unions.
   */
  type = 'unknown' as const
  /**
   * A short summary of the unknown type.
   */
  title: string | undefined
  /**
   * A description of the unknown type.
   */
  description: string | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /** An example of the unknown type. */
  example: unknown | undefined

  constructor(fields: UnknownFields) {
    this.title = fields.title
    this.description = fields.description
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasUnknown {
    return this
  }

  resolveOnce(): OasUnknown {
    return this
  }

  toJsonSchema(_options?: ToJsonSchemaOptions): OpenAPIV3.SchemaObject {
    return {
      title: this.title,
      description: this.description,
      example: this.example
    }
  }
}
