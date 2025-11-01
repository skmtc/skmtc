import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasString}.
 *
 * @template Nullable - Whether the string value can be null
 */
export type StringFields<Nullable extends boolean | undefined> = {
  /** A short summary of the string schema */
  title?: string
  /** A description of the string schema */
  description?: string
  /** String format (e.g., 'email', 'date-time', 'uri') */
  format?: string
  /** Default value for the string */
  default?: Nullable extends true ? string | null | undefined : string | undefined
  /** Regular expression pattern for validation */
  pattern?: string
  /** Array of allowed enum values */
  enums?: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
  /** Maximum length constraint */
  maxLength?: number
  /** Minimum length constraint */
  minLength?: number
  /** Whether the string value can be null */
  nullable?: Nullable
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the string */
  example?: Nullable extends true ? string | null | undefined : string | undefined
  /** Whether the string is read-only */
  readOnly?: boolean
  /** Whether the string is write-only */
  writeOnly?: boolean
  /** Whether the string is deprecated */
  deprecated?: boolean
}

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
  nullable: Nullable | undefined
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
  /**
   * Whether the string is read-only.
   */
  readOnly: boolean | undefined
  /**
   * Whether the string is write-only.
   */
  writeOnly: boolean | undefined
  /**
   * Whether the string is deprecated.
   */
  deprecated: boolean | undefined
  constructor(fields: StringFields<Nullable> = {}) {
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
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
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
      default: this.default,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly
    }
  }
}
