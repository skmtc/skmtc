import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
/**
 * Constructor fields for {@link OasInteger}.
 * 
 * @template Nullable - Whether the integer value can be null
 */
export type IntegerFields<Nullable extends boolean | undefined> = {
  /** A short summary of the integer schema */
  title?: string
  /** A description of the integer schema */
  description?: string
  /** Whether the integer value can be null */
  nullable?: Nullable
  /** Integer format specification (int32 or int64) */
  format?: 'int32' | 'int64'
  /** Default value for the integer */
  default?: Nullable extends true ? number | null | undefined : number | undefined
  /** Array of allowed enum values */
  enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the integer */
  example?: Nullable extends true ? number | null | undefined : number | undefined
  /** Number must be a multiple of this value */
  multipleOf?: number
  /** Maximum value (inclusive) */
  maximum?: number
  /** Whether maximum is exclusive */
  exclusiveMaximum?: boolean
  /** Minimum value (inclusive) */
  minimum?: number
  /** Whether minimum is exclusive */
  exclusiveMinimum?: boolean
}

/**
 * Represents an integer schema in the OpenAPI Specification.
 * 
 * `OasInteger` handles integer type definitions with comprehensive validation
 * constraints including range limits, multiple-of validation, format specifications,
 * and enum restrictions. It supports both 32-bit and 64-bit integer formats
 * and provides nullable type support.
 * 
 * This class is used throughout the OAS processing pipeline to represent
 * integer fields in API schemas, including IDs, counts, timestamps, and
 * other numeric values that must be whole numbers.
 * 
 * ## Key Features
 * 
 * - **Format Support**: int32 and int64 format specifications
 * - **Range Validation**: Minimum and maximum value constraints
 * - **Multiple Validation**: Ensure values are multiples of specified numbers
 * - **Enum Values**: Restricted sets of allowed integer values
 * - **Nullable Support**: Type-safe nullable integer handling
 * - **JSON Schema**: Conversion to standard JSON Schema format
 * 
 * @template Nullable - Whether the integer value can be null
 * 
 * @example Basic integer schema
 * ```typescript
 * import { OasInteger } from '@skmtc/core';
 * 
 * const ageInteger = new OasInteger({
 *   title: 'Age',
 *   description: 'Person age in years',
 *   minimum: 0,
 *   maximum: 150,
 *   example: 25
 * });
 * ```
 * 
 * @example ID with int64 format
 * ```typescript
 * const userIdInteger = new OasInteger({
 *   title: 'User ID',
 *   description: 'Unique user identifier',
 *   format: 'int64',
 *   minimum: 1,
 *   example: 1234567890123
 * });
 * ```
 * 
 * @example Count with multiple-of validation
 * ```typescript
 * const batchSizeInteger = new OasInteger({
 *   title: 'Batch Size',
 *   description: 'Number of items to process',
 *   minimum: 10,
 *   maximum: 1000,
 *   multipleOf: 10, // Must be multiple of 10
 *   default: 50
 * });
 * ```
 * 
 * @example Status code enum
 * ```typescript
 * const statusCodeInteger = new OasInteger({
 *   title: 'HTTP Status Code',
 *   description: 'Valid HTTP response status codes',
 *   enums: [200, 201, 400, 401, 404, 500],
 *   example: 200
 * });
 * ```
 * 
 * @example Nullable integer
 * ```typescript
 * const optionalCountInteger = new OasInteger<true>({
 *   title: 'Optional Count',
 *   description: 'Count value that can be null',
 *   nullable: true,
 *   minimum: 0,
 *   default: null
 * });
 * ```
 */
export class OasInteger<Nullable extends boolean | undefined = boolean | undefined> {
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
  nullable: Nullable | undefined
  /**
   * The format of the integer.
   */
  format: 'int32' | 'int64' | undefined
  /**
   * An array of allowed values for the integer.
   */
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the integer.
   */
  example: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * The multiple of the integer.
   */
  multipleOf: number | undefined
  /**
   * The maximum value of the integer.
   */
  maximum: number | undefined
  /**
   * Whether the maximum value is exclusive.
   */
  exclusiveMaximum: boolean | undefined
  /**
   * The minimum value of the integer.
   */
  minimum: number | undefined
  /**
   * Whether the minimum value is exclusive.
   */
  exclusiveMinimum: boolean | undefined
  /**
   * The default value of the integer.
   */
  default: Nullable extends true ? number | null | undefined : number | undefined
  constructor(fields: IntegerFields<Nullable> = {}) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.format = fields.format
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.multipleOf = fields.multipleOf
    this.maximum = fields.maximum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minimum = fields.minimum
    this.exclusiveMinimum = fields.exclusiveMinimum
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasInteger<Nullable> {
    return this
  }

  resolveOnce(): OasInteger<Nullable> {
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
      example: this.example,
      multipleOf: this.multipleOf,
      maximum: this.maximum,
      exclusiveMaximum: this.exclusiveMaximum,
      minimum: this.minimum,
      exclusiveMinimum: this.exclusiveMinimum,
      default: this.default
    }
  }
}
