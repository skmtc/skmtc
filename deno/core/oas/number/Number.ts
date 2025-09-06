import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'

/**
 * Constructor fields for {@link OasNumber}.
 * 
 * @template Nullable - Whether the number can be null (affects type unions)
 */
export type NumberFields<Nullable extends boolean | undefined> = {
  /** A short summary of the number schema */
  title?: string
  /** A description of the number schema */
  description?: string
  /** Whether the number value can be null */
  nullable?: Nullable
  /** Default value for the number (null allowed if Nullable is true) */
  default?: Nullable extends true ? number | null | undefined : number | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the number (null allowed if Nullable is true) */
  example?: Nullable extends true ? number | null | undefined : number | undefined
  /** Array of valid enum values for the number (null allowed if Nullable is true) */
  enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** The format of the number (float or double precision) */
  format?: 'float' | 'double'
  /** Value must be a multiple of this number */
  multipleOf?: number
  /** Maximum value allowed (inclusive by default) */
  maximum?: number
  /** Whether the maximum value is exclusive */
  exclusiveMaximum?: boolean
  /** Minimum value allowed (inclusive by default) */
  minimum?: number
  /** Whether the minimum value is exclusive */
  exclusiveMinimum?: boolean
}

/**
 * Represents a number schema in the OpenAPI Specification.
 * 
 * The `OasNumber` class handles floating-point numeric data types in OpenAPI schemas,
 * supporting comprehensive validation constraints including ranges, precision formats,
 * and mathematical constraints. This class provides type-safe number handling with
 * optional null value support and extensive validation capabilities.
 * 
 * ## Key Features
 * 
 * - **Range Validation**: Minimum and maximum constraints with exclusive/inclusive options
 * - **Precision Control**: Float and double format support for different precision needs  
 * - **Mathematical Constraints**: Multiple-of validation for specific numeric patterns
 * - **Type Safety**: Generic nullable type support with proper TypeScript inference
 * - **Enum Support**: Constrain numbers to specific allowed values
 * - **Null Handling**: Optional null value support for nullable number types
 * 
 * @template Nullable - Whether the number value itself can be null
 * 
 * @example Basic number schema with range
 * ```typescript
 * import { OasNumber } from '@skmtc/core';
 * 
 * const ageSchema = new OasNumber({
 *   title: 'Age',
 *   description: 'Person age in years',
 *   minimum: 0,
 *   maximum: 150,
 *   example: 25,
 *   default: 18
 * });
 * 
 * // This represents: number (0 <= value <= 150)
 * ```
 * 
 * @example Price with precision and constraints
 * ```typescript
 * const priceSchema = new OasNumber({
 *   title: 'Product Price',
 *   description: 'Price in USD with cent precision',
 *   format: 'double',
 *   minimum: 0,
 *   exclusiveMinimum: true, // Must be > 0, not >= 0
 *   multipleOf: 0.01, // Must be in cents (e.g., 19.99, 10.50)
 *   example: 29.99
 * });
 * 
 * // This represents: number > 0, in multiples of 0.01
 * ```
 * 
 * @example Percentage with strict bounds
 * ```typescript
 * const percentageSchema = new OasNumber({
 *   title: 'Completion Percentage',
 *   description: 'Task completion as a percentage',
 *   minimum: 0,
 *   maximum: 100,
 *   multipleOf: 0.1, // One decimal place precision
 *   example: 75.5,
 *   default: 0
 * });
 * 
 * // This represents: 0 <= value <= 100, in increments of 0.1
 * ```
 * 
 * @example Nullable rating system
 * ```typescript
 * const ratingSchema = new OasNumber<true>({
 *   title: 'User Rating',
 *   description: 'Product rating from 1-5 stars, null if not rated',
 *   nullable: true,
 *   minimum: 1,
 *   maximum: 5,
 *   multipleOf: 0.5, // Allow half-star ratings
 *   enums: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, null],
 *   example: 4.5,
 *   default: null
 * });
 * 
 * // This represents: (1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5) | null
 * ```
 * 
 * @example Scientific measurement with high precision
 * ```typescript
 * const temperatureSchema = new OasNumber({
 *   title: 'Temperature',
 *   description: 'Temperature in Celsius with high precision',
 *   format: 'double',
 *   minimum: -273.15, // Absolute zero
 *   maximum: 1000,
 *   multipleOf: 0.001, // Millikelvin precision
 *   example: 23.456
 * });
 * 
 * // For scientific applications requiring high precision
 * ```
 * 
 * @example Currency with regional constraints
 * ```typescript
 * const currencySchema = new OasNumber({
 *   title: 'Amount',
 *   description: 'Transaction amount in major currency units',
 *   format: 'double',
 *   minimum: 0,
 *   maximum: 999999.99,
 *   multipleOf: 0.01,
 *   example: 1234.56
 * });
 * 
 * // Used in financial applications
 * const transaction = new OasObject({
 *   properties: {
 *     amount: currencySchema,
 *     currency: new OasString({ enum: ['USD', 'EUR', 'GBP'] })
 *   }
 * });
 * ```
 * 
 * @example Coordinate system
 * ```typescript
 * const latitudeSchema = new OasNumber({
 *   title: 'Latitude',
 *   description: 'Geographic latitude coordinate',
 *   format: 'double',
 *   minimum: -90,
 *   maximum: 90,
 *   example: 40.7128
 * });
 * 
 * const longitudeSchema = new OasNumber({
 *   title: 'Longitude', 
 *   description: 'Geographic longitude coordinate',
 *   format: 'double',
 *   minimum: -180,
 *   maximum: 180,
 *   example: -74.0060
 * });
 * 
 * // Used for location data
 * ```
 * 
 * @example Probability and statistics
 * ```typescript
 * const probabilitySchema = new OasNumber({
 *   title: 'Probability',
 *   description: 'Statistical probability value',
 *   minimum: 0,
 *   maximum: 1,
 *   exclusiveMaximum: false, // Can be exactly 1
 *   example: 0.75,
 *   default: 0.5
 * });
 * 
 * const confidenceSchema = new OasNumber({
 *   title: 'Confidence Level',
 *   description: 'Statistical confidence level as percentage',
 *   minimum: 0,
 *   maximum: 100,
 *   enums: [90, 95, 99], // Common confidence levels
 *   example: 95
 * });
 * ```
 */
export class OasNumber<Nullable extends boolean | undefined = boolean | undefined> {
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
   * The default value of the number.
   */
  default: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * A description of the number.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the number.
   */
  example: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * An array of allowed values for the number.
   */
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /**
   * The format of the number.
   */
  format: 'float' | 'double' | undefined
  /**
   * The multiple of the number.
   */
  multipleOf: number | undefined
  /**
   * The maximum value of the number.
   */
  maximum: number | undefined
  /**
   * Whether the maximum value is exclusive.
   */
  exclusiveMaximum: boolean | undefined
  /**
   * The minimum value of the number.
   */
  minimum: number | undefined
  /**
   * Whether the minimum value is exclusive.
   */
  exclusiveMinimum: boolean | undefined
  constructor(fields: NumberFields<Nullable> = {}) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.default = fields.default
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.enums = fields.enums
    this.format = fields.format
    this.multipleOf = fields.multipleOf
    this.maximum = fields.maximum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minimum = fields.minimum
    this.exclusiveMinimum = fields.exclusiveMinimum
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasNumber<Nullable> {
    return this
  }

  resolveOnce(): OasNumber<Nullable> {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'number',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      enum: this.enums,
      format: this.format,
      multipleOf: this.multipleOf,
      maximum: this.maximum,
      exclusiveMaximum: this.exclusiveMaximum,
      minimum: this.minimum,
      exclusiveMinimum: this.exclusiveMinimum
    }
  }
}
