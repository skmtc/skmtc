import type { OpenAPIV3 } from 'openapi-types'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
export type BooleanFields = {
  title?: string
  description?: string
  nullable?: boolean
  extensionFields?: Record<string, unknown>
  example?: boolean
}

/**
 * Object representing a boolean in the OpenAPI Specification.
 */
export class OasBoolean {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'boolean' useful for type narrowing and tagged unions.
   */
  type = 'boolean' as const
  /**
   * A short summary of the boolean.
   */
  title: string | undefined
  /**
   * A description of the boolean.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the boolean.
   */
  example: boolean | undefined

  constructor(fields: BooleanFields) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasBoolean {
    return this
  }

  resolveOnce(): OasBoolean {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.SchemaObject {
    return {
      type: 'boolean',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example
    }
  }
}
