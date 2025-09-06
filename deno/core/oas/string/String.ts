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
}

/**
 * Represents a string schema in the OpenAPI Specification.
 * 
 * `OasString` handles string type definitions with comprehensive validation
 * constraints including format validation, length limits, pattern matching,
 * and enum restrictions. It supports nullable types and provides JSON Schema
 * conversion for validation purposes.
 * 
 * This class is used throughout the OAS processing pipeline to represent
 * string fields in API schemas, parameters, and request/response bodies.
 * 
 * ## Key Features
 * 
 * - **Format Validation**: Support for standard formats (email, date-time, uri, etc.)
 * - **Length Constraints**: Minimum and maximum length validation
 * - **Pattern Matching**: Regular expression validation
 * - **Enum Values**: Restricted sets of allowed values
 * - **Nullable Support**: Type-safe nullable string handling
 * - **JSON Schema**: Conversion to standard JSON Schema format
 * 
 * @template Nullable - Whether the string value can be null
 * 
 * @example Basic string schema
 * ```typescript
 * import { OasString } from '@skmtc/core';
 * 
 * const basicString = new OasString({
 *   title: 'User Name',
 *   description: 'The full name of the user',
 *   minLength: 1,
 *   maxLength: 100
 * });
 * ```
 * 
 * @example Email format validation
 * ```typescript
 * const emailString = new OasString({
 *   title: 'Email Address',
 *   description: 'Valid email address',
 *   format: 'email',
 *   example: 'user@example.com'
 * });
 * ```
 * 
 * @example Enum with allowed values
 * ```typescript
 * const statusString = new OasString({
 *   title: 'Status',
 *   description: 'Current status of the item',
 *   enums: ['pending', 'approved', 'rejected'],
 *   default: 'pending'
 * });
 * ```
 * 
 * @example Pattern validation
 * ```typescript
 * const phoneString = new OasString({
 *   title: 'Phone Number',
 *   description: 'US phone number format',
 *   pattern: '^\\+?1?[2-9]\\d{2}[2-9]\\d{2}\\d{4}$',
 *   example: '+15551234567'
 * });
 * ```
 * 
 * @example Nullable string
 * ```typescript
 * const nullableString = new OasString<true>({
 *   title: 'Optional Note',
 *   description: 'Optional note that can be null',
 *   nullable: true,
 *   default: null
 * });
 * ```
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
   * Creates a new OasString instance.
   * 
   * @param fields - String schema configuration fields
   * 
   * @example
   * ```typescript
   * const userIdString = new OasString({
   *   title: 'User ID',
   *   description: 'Unique identifier for user',
   *   format: 'uuid',
   *   example: '123e4567-e89b-12d3-a456-426614174000'
   * });
   * ```
   */
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
