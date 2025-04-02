import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type StringFields<Nullable extends boolean | undefined> = {
  title?: string
  description?: string
  format?: string
  default?: Nullable extends true ? string | null | undefined : string | undefined
  pattern?: string
  enums?: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
  maxLength?: number
  minLength?: number
  nullable: Nullable
  extensionFields?: Record<string, unknown>
  example?: Nullable extends true ? string | null | undefined : string | undefined
}

/**
 * Object representing a string in the OpenAPI Specification.
 */
export class OasString<Nullable extends boolean | undefined = boolean | undefined> {
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
  enums: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
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
  nullable: Nullable
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /** An example of the string. */
  example: Nullable extends true ? string | null | undefined : string | undefined
  /**
   * The pattern of the string.
   */
  pattern: string | undefined
  /**
   * The default value of the string.
   */
  default: Nullable extends true ? string | null | undefined : string | undefined

  constructor(fields: StringFields<Nullable>) {
    this.title = fields.title
    this.description = fields.description
    this.format = fields.format
    this.enums = fields.enums
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.maxLength = fields.maxLength
    this.minLength = fields.minLength
    this.pattern = fields.pattern
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasString<Nullable> {
    return this
  }

  resolveOnce(): OasString<Nullable> {
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
      minLength: this.minLength,
      pattern: this.pattern,
      default: this.default
    }
  }
}
