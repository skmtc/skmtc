import type { OasRef } from '../ref/Ref.js'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'
import type { OpenAPIV3 } from 'openapi-types'

export type StringFields = {
  title?: string
  description?: string
  format?: string
  // pattern?: string
  enums?: string[]
  maxLength?: number
  minLength?: number
  nullable?: boolean
  extensionFields?: Record<string, unknown>
  example?: string
}

/**
 * Object representing a string in the OpenAPI Specification.
 */
export class OasString {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'string' useful for type narrowing and tagged unions.
   */
  type = 'string' as const
  /**
   * A short summary of the string.
   */
  title: string | undefined
  /**
   * A description of the string.
   */
  description: string | undefined
  /**
   * The format of the string.
   */
  format: string | undefined
  /**
   * An array of allowed values for the string.
   */
  enums: string[] | undefined
  /**
   * The maximum length of the string.
   */
  maxLength: number | undefined
  /**
   * The minimum length of the string.
   */
  minLength: number | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /** An example of the string. */
  example: string | undefined

  constructor(fields: StringFields) {
    this.title = fields.title
    this.description = fields.description
    this.format = fields.format
    this.enums = fields.enums
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.maxLength = fields.maxLength
    this.minLength = fields.minLength
  }

  // get pattern() {
  //   return this.fields.pattern
  // }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasString {
    return this
  }

  resolveOnce(): OasString {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'string',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      format: this.format,
      enum: this.enums,
      maxLength: this.maxLength,
      minLength: this.minLength
    }
  }
}
