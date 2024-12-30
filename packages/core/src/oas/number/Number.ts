import type { OasRef } from '../ref/Ref.js'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'
export type NumberFields = {
  title?: string
  description?: string
  nullable?: boolean
  extensionFields?: Record<string, unknown>
  example?: number
}

/**
 * Object representing a number in the OpenAPI Specification.
 */
export class OasNumber {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'number' useful for type narrowing and tagged unions.
   */
  type = 'number' as const
  /**
   * A short summary of the number.
   */
  title: string | undefined
  /**
   * A description of the number.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the number.
   */
  example: number | undefined

  constructor(fields: NumberFields) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasNumber {
    return this
  }

  resolveOnce(): OasNumber {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.SchemaObject {
    return {
      type: 'number',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example
    }
  }
}
