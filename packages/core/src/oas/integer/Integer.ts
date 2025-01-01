import type { OasRef } from '../ref/Ref.js'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'
export type IntegerFields = {
  title?: string
  description?: string
  nullable?: boolean
  format?: 'int32' | 'int64'
  enums?: number[]
  extensionFields?: Record<string, unknown>
  example?: number
}

export class OasInteger {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'integer' useful for type narrowing and tagged unions.
   */
  type = 'integer' as const
  /**
   * A short summary of the integer.
   */
  title: string | undefined
  /**
   * A description of the integer.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /**
   * The format of the integer.
   */
  format: 'int32' | 'int64' | undefined
  /**
   * An array of allowed values for the integer.
   */
  enums: number[] | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the integer.
   */
  example: number | undefined

  constructor(fields: IntegerFields) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.format = fields.format
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasInteger {
    return this
  }

  resolveOnce(): OasInteger {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'integer',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      format: this.format,
      enum: this.enums,
      example: this.example
    }
  }
}
