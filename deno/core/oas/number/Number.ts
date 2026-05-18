import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import { Located } from '@/types/Located.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

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
  /** Whether the number is read-only */
  readOnly?: boolean
  /** Whether the number is write-only */
  writeOnly?: boolean
  /** Whether the number is deprecated */
  deprecated?: boolean
}

export class OasNumber<Nullable extends boolean | undefined = boolean | undefined> extends Located {
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
  /**
   * Whether the number is read-only.
   */
  readOnly: boolean | undefined
  /**
   * Whether the number is write-only.
   */
  writeOnly: boolean | undefined
  /**
   * Whether the number is deprecated.
   */
  deprecated: boolean | undefined
  constructor(fields: NumberFields<Nullable> = {}, context?: ParseContextType) {
    super(context)
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
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
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
      exclusiveMinimum: this.exclusiveMinimum,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly
    }
  }
}
